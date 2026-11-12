"""
PDF text extraction, layout analysis, and structure detection for academic journal papers.
Extracts coordinate-based bounding boxes, font attributes, images, tables,
and section headings using PyMuPDF.
"""

import os
import re
import logging
from typing import List, Dict, Any, Tuple
import pymupdf

logger = logging.getLogger(__name__)


class PDFExtractor:
    """Extracts text, layout coordinates, images, and detects structure from PDF documents."""

    SECTION_HEADINGS = [
        "abstract",
        "introduction",
        "background",
        "literature review",
        "theoretical framework",
        "methodology",
        "methods",
        "materials and methods",
        "experimental setup",
        "experimental program",
        "research method",
        "results",
        "results and discussion",
        "discussion",
        "analysis",
        "findings",
        "conclusion",
        "conclusions",
        "summary",
        "recommendations",
        "acknowledgements",
        "acknowledgments",
        "references",
        "bibliography",
        "appendix",
        "appendices",
    ]

    def __init__(self):
        pass

    def extract_from_file(self, pdf_path: str) -> Dict[str, Any]:
        """
        Extract detailed layout blocks (with coordinates, fonts, colors), images,
        and detected sections from a PDF file.

        Returns:
            dict with:
                - filename
                - total_pages
                - is_scanned
                - has_text
                - pages: list of page dicts with rich block info & image bboxes
                - full_text
                - sections
        """
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")

        try:
            doc = pymupdf.open(pdf_path)
        except Exception as e:
            raise RuntimeError(f"Failed to open PDF: {str(e)}")

        filename = os.path.basename(pdf_path)
        total_pages = len(doc)
        pages = []
        full_text_parts = []
        total_text_length = 0

        for page_num in range(total_pages):
            page = doc[page_num]
            page_rect = page.rect
            page_text = page.get_text("text") or ""
            total_text_length += len(page_text.strip())

            blocks = []
            images = []

            # Extract raw layout dictionary
            try:
                raw_dict = page.get_text("dict", flags=pymupdf.TEXT_PRESERVE_WHITESPACE)
                raw_blocks = raw_dict.get("blocks", [])

                for b_idx, block in enumerate(raw_blocks):
                    b_type = block.get("type", 0)
                    bbox = list(block.get("bbox", (0, 0, 0, 0)))

                    if b_type == 1:
                        # Image block
                        images.append({
                            "bbox": bbox,
                            "width": bbox[2] - bbox[0],
                            "height": bbox[3] - bbox[1],
                        })
                        continue

                    # Text block (type 0)
                    lines = block.get("lines", [])
                    if not lines:
                        continue

                    block_text_lines = []
                    font_sizes = []
                    font_names = []
                    font_colors = []
                    is_bold = False
                    is_italic = False

                    for line in lines:
                        line_spans = line.get("spans", [])
                        line_text = "".join(span.get("text", "") for span in line_spans)
                        block_text_lines.append(line_text)

                        for span in line_spans:
                            stext = span.get("text", "").strip()
                            if not stext:
                                continue
                            font_sizes.append(span.get("size", 10.0))
                            fname = span.get("font", "helv").lower()
                            font_names.append(fname)
                            if "bold" in fname or "black" in fname or "heavy" in fname or (span.get("flags", 0) & 2):
                                is_bold = True
                            if "italic" in fname or "oblique" in fname or (span.get("flags", 0) & 1):
                                is_italic = True

                            # Parse integer color to RGB tuple
                            c_int = span.get("color", 0)
                            r = ((c_int >> 16) & 255) / 255.0
                            g = ((c_int >> 8) & 255) / 255.0
                            b = (c_int & 255) / 255.0
                            font_colors.append((r, g, b))

                    block_text = " ".join(block_text_lines).strip()
                    if not block_text:
                        continue

                    avg_font_size = sum(font_sizes) / len(font_sizes) if font_sizes else 10.0
                    dom_font = font_names[0] if font_names else "helv"
                    dom_color = font_colors[0] if font_colors else (0.0, 0.0, 0.0)

                    # Classify block type
                    is_eq = self._is_equation_block(block_text)
                    is_head = is_bold and (avg_font_size >= 11.0 or len(block_text) < 80)
                    is_caption = bool(re.match(r"^(?:Fig(?:ure|\.)?|Tab(?:le|\.)?|Grafik|Gambar)\s*\d+", block_text, re.IGNORECASE))
                    is_hdr_ftr = (bbox[1] < 45 or bbox[3] > page_rect.height - 45) and avg_font_size <= 9.0

                    blocks.append({
                        "block_id": f"p{page_num + 1}_b{b_idx}",
                        "page_number": page_num + 1,
                        "bbox": bbox,
                        "text": block_text,
                        "font_size": round(avg_font_size, 1),
                        "font_name": dom_font,
                        "is_bold": is_bold,
                        "is_italic": is_italic,
                        "font_color": dom_color,
                        "line_count": len(lines),
                        "is_equation": is_eq,
                        "is_heading": is_head,
                        "is_caption": is_caption,
                        "is_header_footer": is_hdr_ftr,
                    })

            except Exception as e:
                logger.warning(f"Error parsing layout dict for page {page_num + 1}: {e}")
                if page_text.strip():
                    blocks.append({
                        "block_id": f"p{page_num + 1}_b0",
                        "page_number": page_num + 1,
                        "bbox": [50, 50, page_rect.width - 50, page_rect.height - 50],
                        "text": page_text.strip(),
                        "font_size": 10.0,
                        "font_name": "helv",
                        "is_bold": False,
                        "is_italic": False,
                        "font_color": (0.0, 0.0, 0.0),
                        "line_count": 1,
                        "is_equation": False,
                        "is_heading": False,
                        "is_caption": False,
                        "is_header_footer": False,
                    })

            pages.append({
                "page_number": page_num + 1,
                "width": round(page_rect.width, 2),
                "height": round(page_rect.height, 2),
                "text": page_text,
                "blocks": blocks,
                "images": images,
            })
            full_text_parts.append(page_text)

        doc.close()

        full_text = "\n".join(full_text_parts)
        has_text = total_text_length > 50
        is_scanned = not has_text

        sections = self._detect_sections(pages, full_text) if has_text else []

        return {
            "filename": filename,
            "total_pages": total_pages,
            "is_scanned": is_scanned,
            "has_text": has_text,
            "pages": pages,
            "full_text": full_text,
            "sections": sections,
        }

    def _is_equation_block(self, text: str) -> bool:
        """Identify if a block is primarily a mathematical equation."""
        s = text.strip()
        if re.match(r"^(?:Eq\.|Equation|Persamaan)\s*\(\d+", s):
            return True
        if re.search(r"=\s*[^,\n;]+(?:\+|-|\*|/|\^)+", s):
            return True
        # Ratio of math symbols
        math_chars = set("=+-*/^√∑∫≤≥≠≈αβγδεθλμπστωΔΩ")
        if any(c in math_chars for c in s) and len(s) < 100:
            return True
        return False

    def _detect_sections(self, pages: List[Dict[str, Any]], full_text: str) -> List[Dict[str, Any]]:
        """
        Detect journal sections (Abstract, Intro, Method, etc.) for high-level reader view.
        """
        sections = []
        heading_candidates = []

        for p in pages:
            p_num = p["page_number"]
            for b in p.get("blocks", []):
                t = b["text"].strip()
                t_lower = t.lower()
                clean_heading = re.sub(r"^[\d\.\s\-]+", "", t_lower).strip()

                for h in self.SECTION_HEADINGS:
                    if clean_heading == h or (clean_heading.startswith(h) and len(clean_heading) <= len(h) + 15):
                        heading_candidates.append({
                            "name": t,
                            "page": p_num,
                            "block": b,
                        })
                        break

        if not heading_candidates:
            # Fallback: create sections per page or title + full text
            return [{
                "name": "Full Document",
                "start_page": 1,
                "end_page": len(pages),
                "text": full_text.strip(),
            }]

        for idx, hc in enumerate(heading_candidates):
            name = hc["name"]
            start_p = hc["page"]
            end_p = heading_candidates[idx + 1]["page"] if idx + 1 < len(heading_candidates) else len(pages)

            # Collect text between this heading and the next
            sec_text_parts = []
            capturing = False
            for p in pages:
                if p["page_number"] < start_p:
                    continue
                if p["page_number"] > end_p:
                    break
                for b in p.get("blocks", []):
                    if b["text"].strip() == name:
                        capturing = True
                        continue
                    if idx + 1 < len(heading_candidates) and b["text"].strip() == heading_candidates[idx + 1]["name"]:
                        capturing = False
                        break
                    if capturing and not b.get("is_header_footer"):
                        sec_text_parts.append(b["text"])

            sec_body = "\n\n".join(sec_text_parts).strip()
            sections.append({
                "name": name,
                "start_page": start_p,
                "end_page": end_p,
                "text": sec_body if sec_body else name,
            })

        return sections
