import os
import base64
import uuid
import pymupdf
import logging
from typing import Dict, Any, Optional
from config import Config

logger = logging.getLogger(__name__)

class ExportService:
    @staticmethod
    def export_pdf_with_annotations(
        source_pdf_path: str,
        page_overlays: Dict[str, str],
        output_filename: Optional[str] = None
    ) -> str:
        """
        Burn annotation overlays into a PDF document using PyMuPDF.
        
        Args:
            source_pdf_path: Path to the original presentation PDF file.
            page_overlays: Dict mapping page number (as str or int, 1-indexed)
                           to base64 data URLs (e.g. 'data:image/png;base64,...').
            output_filename: Optional custom output file name.
            
        Returns:
            Absolute path to the exported PDF file.
        """
        if not os.path.exists(source_pdf_path):
            raise FileNotFoundError(f"File sumber PDF tidak ditemukan: {source_pdf_path}")

        os.makedirs(Config.EXPORTS_FOLDER, exist_ok=True)
        
        if not output_filename:
            base_source = os.path.splitext(os.path.basename(source_pdf_path))[0]
            output_filename = f"{base_source}_annotated_{uuid.uuid4().hex[:8]}.pdf"
        elif not output_filename.endswith('.pdf'):
            output_filename += '.pdf'

        output_path = os.path.join(Config.EXPORTS_FOLDER, output_filename)

        doc = pymupdf.open(source_pdf_path)
        try:
            total_pages = len(doc)
            
            for page_key, data_url in page_overlays.items():
                try:
                    page_num = int(page_key)
                except ValueError:
                    continue
                    
                page_idx = page_num - 1
                if page_idx < 0 or page_idx >= total_pages:
                    continue

                if not data_url or not isinstance(data_url, str):
                    continue

                # Parse base64 data url
                if ',' in data_url:
                    _, b64_data = data_url.split(',', 1)
                else:
                    b64_data = data_url
                    
                try:
                    img_bytes = base64.b64decode(b64_data)
                except Exception as e:
                    logger.warning(f"Gagal mendekode gambar anotasi untuk halaman {page_num}: {e}")
                    continue

                page = doc[page_idx]
                page_rect = page.rect
                
                # Insert transparent overlay image on top of existing slide content
                page.insert_image(
                    page_rect,
                    stream=img_bytes,
                    keep_proportion=False,
                    overlay=True
                )

            # Update document metadata
            doc.set_metadata({
                "creator": "Free Corat-Coret PPT",
                "producer": "PyMuPDF - Free Corat-Coret PPT Engine",
                "title": os.path.splitext(output_filename)[0]
            })

            doc.save(
                output_path,
                garbage=4,
                deflate=True,
                clean=True
            )
            logger.info(f"Berhasil mengekspor PDF beranotasi ke: {output_path}")
            return output_path

        finally:
            doc.close()

