"""
Document reconstruction and export builder for AI Journal Translator.
Implements coordinate-based layout preservation, keeping original images, diagrams,
tables, equations, and multi-column formatting intact.
"""

import os
import re
import math
import unicodedata
import logging
import pymupdf
from typing import List, Dict, Any, Optional
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

logger = logging.getLogger(__name__)


def _clean_pdf_text(text: str) -> str:
    """Normalize and map typographic / unicode characters to prevent '?' in Base-14 PDF fonts."""
    if not text:
        return ""
    replacements = {
        "\u2013": "-",
        "\u2014": "--",
        chr(8216): "'",
        chr(8217): "'",
        chr(8220): '"',
        chr(8221): '"',
        "\u2026": "...",
        "\u00a0": " ",
        "\u2022": "*",
        "\u2264": "<=",
        "\u2265": ">=",
        "\u00b1": "+/-",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    # Decompose accented characters (e.g. František -> Frantisek)
    text = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))
    # Keep only characters encodable in latin-1 / winansi
    return "".join(c for c in text if ord(c) < 256)


def _pick_font(font_name: str, is_bold: bool, is_italic: bool) -> str:
    """Choose the best available PyMuPDF Base-14 font given original font name and style."""
    fname = (font_name or "").lower().replace(" ", "").replace("-", "")
    is_serif = any(k in fname for k in ["time", "serif", "georgia", "garamond", "palatino", "roman"])
    is_mono  = any(k in fname for k in ["courier", "mono", "consolas", "code", "lucidia"])

    if is_serif:
        if is_bold and is_italic:
            return "tibi"
        elif is_bold:
            return "tibo"
        elif is_italic:
            return "tiit"
        return "tiro"
    elif is_mono:
        if is_bold and is_italic:
            return "cobi"
        elif is_bold:
            return "cobo"
        elif is_italic:
            return "coit"
        return "cour"
    else:
        if is_bold and is_italic:
            return "hebi"
        elif is_bold:
            return "hebo"
        elif is_italic:
            return "heit"
        return "helv"


def _detect_page_bg_color(page: pymupdf.Page) -> tuple:
    """
    Sample the background colour of a page by reading corner pixels.
    Returns an (r, g, b) float tuple in [0,1].
    Falls back to white (1,1,1).
    """
    try:
        clip = pymupdf.Rect(0, 0, min(10, page.rect.width), min(10, page.rect.height))
        pix = page.get_pixmap(clip=clip, dpi=10)
        # pix.samples: bytes, layout RGB
        if pix.samples and len(pix.samples) >= 3:
            r, g, b = pix.samples[0] / 255.0, pix.samples[1] / 255.0, pix.samples[2] / 255.0
            return (r, g, b)
    except Exception:
        pass
    return (1.0, 1.0, 1.0)


class DocumentBuilder:
    """Builds downloadable documents in various formats with layout preservation."""

    @staticmethod
    def build_layout_preserved_pdf(
        original_pdf_path: str,
        translated_pages: List[Dict[str, Any]],
        output_path: str,
    ) -> str:
        """
        MODE A (DEFAULT): In-place coordinate-based text replacement inside the original PDF.

        Strategy:
          1. Open the original PDF so ALL images, vector graphics, table borders are intact.
          2. Per text block: add a redact annotation using the page background colour
             (not always white — prevents white boxes on coloured headers).
          3. Apply redactions with PDF_REDACT_IMAGE_NONE (raster images stay untouched).
          4. Re-insert translated text at the SAME bounding box with auto-fit font size.
          5. Save using incremental=False + garbage=4 to keep all embedded objects.

        Preserves:
          - Page dimensions and margins
          - All raster images (photos, charts, diagrams, figures)
          - Vector drawings and table borders (line/rect paths)
          - Multi-column layout (two-column / three-column)
          - Headers, footers, page numbers
          - Mathematical equation blocks (skipped from translation, kept intact)
        """
        if not os.path.exists(original_pdf_path):
            raise FileNotFoundError(f"Original PDF not found: {original_pdf_path}")

        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Open original — this preserves all embedded resources
        doc = pymupdf.open(original_pdf_path)

        try:
            total_doc_pages = len(doc)

            # Build a lookup: page_number → translated page data
            page_lookup: Dict[int, Dict] = {}
            for p_data in translated_pages:
                p_num = p_data.get("page_number") or p_data.get("page_num", 1)
                if isinstance(p_num, int) and 1 <= p_num <= total_doc_pages:
                    page_lookup[p_num] = p_data

            for page_idx in range(total_doc_pages):
                p_num = page_idx + 1
                p_data = page_lookup.get(p_num)
                if not p_data:
                    continue

                page = doc[page_idx]
                blocks = p_data.get("translated_blocks") or p_data.get("blocks", [])
                if not blocks:
                    continue

                # Detect page background colour for redaction fill
                bg_color = _detect_page_bg_color(page)

                # --- STEP 1: Collect valid blocks to redact ---
                valid_blocks: List[tuple] = []  # (rect, block_dict, fill_color)

                for b in blocks:
                    orig_text  = str(b.get("text", "")).strip()
                    trans_text = str(b.get("translated_text", "")).strip()
                    bbox = b.get("bbox")

                    # Skip if no translated text or no bbox
                    if not bbox or not trans_text:
                        continue
                    # Skip purely mathematical blocks (equations should not be re-rendered as text)
                    if b.get("is_equation") and not re.search(r"[a-zA-Z]{5,}", orig_text):
                        continue
                    # Skip page numbers / short header-footer that are unchanged
                    if b.get("is_header_footer") and orig_text == trans_text and len(orig_text) <= 5:
                        continue

                    rect = pymupdf.Rect(bbox)
                    if rect.is_empty or rect.width <= 1 or rect.height <= 1:
                        continue
                    if rect.x0 < 0 or rect.y0 < 0:
                        continue

                    # Clamp to page bounds
                    rect = rect & page.rect
                    if rect.is_empty:
                        continue

                    # Detect local background colour at block position
                    # Use page bg_color — close enough for most academic papers
                    fill = bg_color

                    # Pad slightly to fully cover original text antialiasing
                    padded = pymupdf.Rect(
                        max(0.0, rect.x0 - 1.0),
                        max(0.0, rect.y0 - 1.0),
                        min(page.rect.width,  rect.x1 + 1.0),
                        min(page.rect.height, rect.y1 + 1.0),
                    )
                    page.add_redact_annot(padded, fill=fill)
                    valid_blocks.append((rect, b))

                if not valid_blocks:
                    continue

                # --- STEP 2: Apply redactions — PRESERVE raster images & vector paths ---
                page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE)

                # --- STEP 3: Re-insert translated text (Single-pass draw for sharp, non-overlapping layout) ---
                for rect, b in valid_blocks:
                    raw_text = str(b.get("translated_text", "")).strip()
                    if not raw_text:
                        continue

                    # Clean and normalize unicode to prevent '?' in Base-14 PDF fonts
                    trans_text = _clean_pdf_text(raw_text)
                    if not trans_text:
                        continue

                    is_bold   = bool(b.get("is_bold", False))
                    is_italic = bool(b.get("is_italic", False))
                    fontname  = _pick_font(b.get("font_name", "helv"), is_bold, is_italic)

                    # Alignment: center for large titles, left for body paragraphs
                    is_heading  = bool(b.get("is_heading", False))
                    orig_fs     = float(b.get("font_size", 10.0))
                    if is_heading and orig_fs >= 13.0:
                        align = 1  # Center
                    else:
                        align = 0  # Left (standard for multi-column academic papers)

                    # Text colour
                    color_raw = b.get("font_color", (0.0, 0.0, 0.0))
                    if isinstance(color_raw, (list, tuple)) and len(color_raw) == 3:
                        font_color = tuple(max(0.0, min(1.0, float(c))) for c in color_raw)
                    else:
                        font_color = (0.0, 0.0, 0.0)

                    # Calculate target font size analytically to prevent multi-draw ghosting
                    orig_len = max(1, len(b.get("text", "")))
                    trans_len = max(1, len(trans_text))
                    length_ratio = trans_len / float(orig_len)

                    if length_ratio > 1.15:
                        # Indonesian is slightly longer: scale font down proportionally
                        scale_factor = max(0.78, min(1.0, 1.0 / (length_ratio ** 0.4)))
                        fs = max(6.5, min(28.0, orig_fs * scale_factor))
                    else:
                        fs = max(6.5, min(28.0, orig_fs))

                    # Expand bounding box downward slightly (15-20%) to prevent text cut-off
                    # without colliding with following sections
                    expand_h = max(2.0, min(14.0, rect.height * 0.18))
                    expanded_rect = pymupdf.Rect(
                        rect.x0,
                        rect.y0,
                        rect.x1,
                        min(page.rect.height - 2.0, rect.y1 + expand_h)
                    )

                    # Single-pass insert_textbox — NO OVERLAPPING GHOST TEXT
                    try:
                        page.insert_textbox(
                            expanded_rect,
                            trans_text,
                            fontsize=fs,
                            fontname=fontname,
                            color=font_color,
                            align=align,
                            lineheight=1.12,
                        )
                    except Exception:
                        fallback_fn = "hebo" if is_bold else "helv"
                        try:
                            page.insert_textbox(
                                expanded_rect,
                                trans_text,
                                fontsize=fs,
                                fontname=fallback_fn,
                                color=font_color,
                                align=align,
                                lineheight=1.12,
                            )
                        except Exception as e_draw:
                            logger.debug(f"Draw fallback error: {e_draw}")

            # Set PDF metadata
            doc.set_metadata({
                "creator":  "Free Corat-Coret PPT — AI Journal Translator",
                "producer": "PyMuPDF Coordinate Layout Engine v2",
                "title":    os.path.splitext(os.path.basename(output_path))[0],
            })

            # Save — garbage=4 removes unused objects, deflate compresses streams
            doc.save(output_path, garbage=4, deflate=True, clean=True)
            logger.info(f"Mode A Layout-Preserved PDF generated: {output_path} "
                        f"({os.path.getsize(output_path) // 1024} KB)")
            return output_path

        finally:
            doc.close()

    @staticmethod
    def build_clean_pdf(
        translated_sections: List[Dict[str, Any]],
        output_path: str,
        document_title: str = "Jurnal Terjemahan",
    ) -> str:
        """
        MODE B: Clean academic reading PDF with formatted headings & paragraphs.
        """
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        pdf = pymupdf.open()

        page_width, page_height = 595.32, 841.92  # Standard A4 size
        margin_x, margin_top, margin_bottom = 54, 54, 54
        usable_width = page_width - (margin_x * 2)

        current_page = pdf.new_page(width=page_width, height=page_height)
        y = margin_top

        # Header Banner
        header_rect = pymupdf.Rect(margin_x, y, margin_x + usable_width, y + 36)
        current_page.draw_rect(header_rect, color=None, fill=(0.12, 0.23, 0.54))
        current_page.insert_text(
            pymupdf.Point(margin_x + 12, y + 22),
            "AI JOURNAL TRANSLATOR — CLEAN READING FLOW",
            fontsize=11,
            fontname="hebo",
            color=(1, 1, 1),
        )
        y += 50

        # Title
        current_page.insert_text(
            pymupdf.Point(margin_x, y),
            document_title[:65],
            fontsize=15,
            fontname="hebo",
            color=(0.1, 0.1, 0.1),
        )
        y += 24

        for sec in translated_sections:
            sec_name = sec.get("translated_name") or sec.get("original_name", "")
            orig_name = sec.get("original_name", "")
            full_header = f"{sec_name.upper()} ({orig_name})" if sec_name != orig_name else sec_name.upper()

            if y > page_height - margin_bottom - 60:
                current_page = pdf.new_page(width=page_width, height=page_height)
                y = margin_top

            # Heading Bar
            current_page.draw_rect(
                pymupdf.Rect(margin_x, y - 2, margin_x + usable_width, y + 16),
                color=None,
                fill=(0.93, 0.95, 0.98),
            )
            current_page.insert_text(
                pymupdf.Point(margin_x + 6, y + 11),
                full_header[:80],
                fontsize=10.5,
                fontname="hebo",
                color=(0.15, 0.25, 0.6),
            )
            y += 24

            body_text = sec.get("translated_text", "")
            paragraphs = body_text.split("\n\n")

            for p in paragraphs:
                clean_p = p.strip()
                if not clean_p:
                    continue

                rect = pymupdf.Rect(margin_x, y, margin_x + usable_width, page_height - margin_bottom)
                res = current_page.insert_textbox(
                    rect,
                    clean_p,
                    fontsize=9.5,
                    fontname="helv",
                    color=(0.15, 0.15, 0.15),
                    lineheight=1.35,
                )

                if res < 0:
                    current_page = pdf.new_page(width=page_width, height=page_height)
                    y = margin_top
                    rect = pymupdf.Rect(margin_x, y, margin_x + usable_width, page_height - margin_bottom)
                    current_page.insert_textbox(
                        rect,
                        clean_p,
                        fontsize=9.5,
                        fontname="helv",
                        color=(0.15, 0.15, 0.15),
                        lineheight=1.35,
                    )

                approx_lines = max(1, len(clean_p) // 95)
                y += min(approx_lines * 14 + 10, page_height - margin_bottom - y)

                if y > page_height - margin_bottom - 30:
                    current_page = pdf.new_page(width=page_width, height=page_height)
                    y = margin_top

            y += 10

        pdf.save(output_path)
        pdf.close()
        return output_path

    @staticmethod
    def build_bilingual_pdf(
        translated_sections: List[Dict[str, Any]],
        output_path: str,
        document_title: str = "Bilingual Journal Translation",
    ) -> str:
        """
        MODE C: Side-by-side bilingual PDF (Original vs Translation) in Landscape A4.
        """
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        pdf = pymupdf.open()

        page_width, page_height = 841.92, 595.32  # Landscape A4
        margin_x, margin_top, margin_bottom = 40, 40, 40
        col_gap = 20
        col_width = (page_width - (margin_x * 2) - col_gap) / 2

        current_page = pdf.new_page(width=page_width, height=page_height)
        y = margin_top

        # Top Header Banner
        current_page.draw_rect(
            pymupdf.Rect(margin_x, y, page_width - margin_x, y + 30),
            color=None,
            fill=(0.12, 0.23, 0.54),
        )
        current_page.insert_text(
            pymupdf.Point(margin_x + 12, y + 20),
            f"BILINGUAL TRANSLATION (ORIGINAL vs INDONESIAN) — {document_title[:60]}",
            fontsize=11,
            fontname="hebo",
            color=(1, 1, 1),
        )
        y += 40

        # Column Headers
        col1_x = margin_x
        col2_x = margin_x + col_width + col_gap

        current_page.insert_text(
            pymupdf.Point(col1_x, y + 10),
            "ORIGINAL TEXT",
            fontsize=10,
            fontname="hebo",
            color=(0.3, 0.3, 0.3),
        )
        current_page.insert_text(
            pymupdf.Point(col2_x, y + 10),
            "TERJEMAHAN (BAHASA INDONESIA)",
            fontsize=10,
            fontname="hebo",
            color=(0.15, 0.25, 0.6),
        )
        y += 18

        current_page.draw_line(
            pymupdf.Point(margin_x, y),
            pymupdf.Point(page_width - margin_x, y),
            color=(0.7, 0.7, 0.7),
            width=0.8,
        )
        y += 12

        for sec in translated_sections:
            orig_name = sec.get("original_name", "")
            trans_name = sec.get("translated_name", "")
            orig_text = sec.get("original_text", "")
            trans_text = sec.get("translated_text", "")

            if y > page_height - margin_bottom - 50:
                current_page = pdf.new_page(width=page_width, height=page_height)
                y = margin_top

            # Section Header
            current_page.insert_text(
                pymupdf.Point(col1_x, y + 10),
                f"SECTION: {orig_name.upper()}",
                fontsize=9.5,
                fontname="hebo",
                color=(0.2, 0.2, 0.2),
            )
            current_page.insert_text(
                pymupdf.Point(col2_x, y + 10),
                f"BAGIAN: {trans_name.upper()}",
                fontsize=9.5,
                fontname="hebo",
                color=(0.15, 0.25, 0.6),
            )
            y += 16

            rect_left = pymupdf.Rect(col1_x, y, col1_x + col_width, page_height - margin_bottom)
            rect_right = pymupdf.Rect(col2_x, y, col2_x + col_width, page_height - margin_bottom)

            current_page.insert_textbox(
                rect_left, orig_text, fontsize=8.5, fontname="helv", color=(0.2, 0.2, 0.2), lineheight=1.3
            )
            current_page.insert_textbox(
                rect_right, trans_text, fontsize=8.5, fontname="helv", color=(0.1, 0.1, 0.1), lineheight=1.3
            )

            max_len = max(len(orig_text), len(trans_text))
            adv = max(35, min(max_len // 4, int(page_height - margin_bottom - y)))
            y += adv + 14

            if y > page_height - margin_bottom - 30:
                current_page = pdf.new_page(width=page_width, height=page_height)
                y = margin_top

        pdf.save(output_path)
        pdf.close()
        return output_path

    @staticmethod
    def build_docx(
        translated_sections: List[Dict[str, Any]],
        output_path: str,
        document_title: str = "Jurnal Terjemahan",
        original_pdf_path: Optional[str] = None,
    ) -> str:
        """Export translated sections to Microsoft Word DOCX format with original images."""
        import io
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        doc = Document()

        # Extract images from original PDF if available
        pdf_images = []
        if original_pdf_path and os.path.exists(original_pdf_path):
            try:
                pdf_doc = pymupdf.open(original_pdf_path)
                for pno in range(len(pdf_doc)):
                    page = pdf_doc[pno]
                    for img_info in page.get_images(full=True):
                        xref = img_info[0]
                        try:
                            pix = pymupdf.Pixmap(pdf_doc, xref)
                            if pix.n >= 5:
                                pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
                            # Keep meaningful figures, skip tiny icons/rules
                            if pix.width >= 100 and pix.height >= 100:
                                png_bytes = pix.tobytes("png")
                                pdf_images.append({
                                    "page": pno + 1,
                                    "bytes": png_bytes,
                                    "width": pix.width,
                                    "height": pix.height
                                })
                        except Exception:
                            continue
                pdf_doc.close()
            except Exception as e_img:
                logger.debug(f"DOCX image extraction error: {e_img}")

        # Title
        title_p = doc.add_paragraph()
        title_run = title_p.add_run(document_title)
        title_run.font.name = "Calibri"
        title_run.font.size = Pt(20)
        title_run.font.bold = True
        title_run.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
        title_p.paragraph_format.space_after = Pt(14)

        # Subtitle
        sub_p = doc.add_paragraph()
        sub_run = sub_p.add_run("Diterjemahkan oleh Free Corat-Coret PPT — AI Journal Translator")
        sub_run.font.size = Pt(10)
        sub_run.font.italic = True
        sub_run.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)
        sub_p.paragraph_format.space_after = Pt(20)

        # Render sections
        for s_idx, sec in enumerate(translated_sections):
            name = sec.get("translated_name") or sec.get("original_name", "")
            orig_name = sec.get("original_name", "")
            text = sec.get("translated_text", "")
            start_page = sec.get("start_page", 1)

            h_text = f"{name} ({orig_name})" if name != orig_name else name
            h = doc.add_heading(h_text, level=1)
            h.paragraph_format.space_before = Pt(14)
            h.paragraph_format.space_after = Pt(6)

            paragraphs = text.split("\n\n")
            for para_text in paragraphs:
                if not para_text.strip():
                    continue
                p = doc.add_paragraph()
                p_run = p.add_run(para_text.strip())
                p_run.font.name = "Calibri"
                p_run.font.size = Pt(11)
                p.paragraph_format.line_spacing = 1.15
                p.paragraph_format.space_after = Pt(6)

            # Insert images that belong to this section's pages
            if pdf_images:
                # Find matching images for this section page range
                matching_images = [img for img in pdf_images if img["page"] == start_page]
                for img_data in matching_images[:3]:
                    try:
                        stream = io.BytesIO(img_data["bytes"])
                        doc.add_picture(stream, width=Inches(5.2))
                        caption_p = doc.add_paragraph()
                        caption_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        caption_run = caption_p.add_run(f"Gambar dari Dokumen Asli (Halaman {img_data['page']})")
                        caption_run.font.size = Pt(9.5)
                        caption_run.font.italic = True
                        caption_run.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)
                        caption_p.paragraph_format.space_after = Pt(12)
                    except Exception:
                        pass

        # If there are remaining unplaced images, add an Appendix of figures
        placed_pages = {sec.get("start_page", 1) for sec in translated_sections}
        remaining_images = [img for img in pdf_images if img["page"] not in placed_pages]
        if remaining_images:
            doc.add_heading("Lampiran Gambar & Grafik Dokumen Asli", level=1)
            for img_data in remaining_images[:8]:
                try:
                    stream = io.BytesIO(img_data["bytes"])
                    doc.add_picture(stream, width=Inches(5.0))
                    cap = doc.add_paragraph()
                    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    c_run = cap.add_run(f"Gambar / Diagram Halaman {img_data['page']}")
                    c_run.font.size = Pt(9.5)
                    c_run.font.italic = True
                    cap.paragraph_format.space_after = Pt(10)
                except Exception:
                    pass

        doc.save(output_path)
        return output_path

    @staticmethod
    def build_txt(translated_sections: List[Dict[str, Any]], output_path: str) -> str:
        """Export translated sections to plain text."""
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            for sec in translated_sections:
                name = sec.get("translated_name") or sec.get("original_name", "")
                text = sec.get("translated_text", "")
                f.write(f"=== {name.upper()} ===\n\n")
                f.write(text.strip() + "\n\n")
                f.write("-" * 50 + "\n\n")
        return output_path

    # Backwards-compatible alias for build_clean_pdf
    build_translated_pdf = build_clean_pdf
