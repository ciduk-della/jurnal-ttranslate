import os
import pymupdf
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class PDFRenderer:
    @staticmethod
    def get_document_info(pdf_path: str) -> Dict[str, Any]:
        """
        Extract page count and dimensions for all pages in a PDF document.
        """
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"File PDF tidak ditemukan: {pdf_path}")

        doc = pymupdf.open(pdf_path)
        try:
            total_pages = len(doc)
            pages_meta = []
            
            for idx in range(total_pages):
                page = doc[idx]
                rect = page.rect
                pages_meta.append({
                    "page_number": idx + 1,
                    "width": round(rect.width, 2),
                    "height": round(rect.height, 2),
                    "aspect_ratio": round(rect.width / rect.height, 4) if rect.height > 0 else 1.0
                })

            return {
                "total_pages": total_pages,
                "pages": pages_meta
            }
        finally:
            doc.close()

    @staticmethod
    def render_page_thumbnail(pdf_path: str, page_number: int, max_dim: int = 240) -> bytes:
        """
        Render a single page thumbnail image (PNG format) using PyMuPDF.
        page_number is 1-indexed.
        """
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"File PDF tidak ditemukan: {pdf_path}")

        doc = pymupdf.open(pdf_path)
        try:
            if page_number < 1 or page_number > len(doc):
                raise ValueError(f"Halaman {page_number} di luar jangkauan (1-{len(doc)}).")

            page = doc[page_number - 1]
            rect = page.rect
            
            # Calculate zoom factor to fit within max_dim
            current_max = max(rect.width, rect.height)
            zoom = (max_dim / current_max) if current_max > 0 else 0.5
            mat = pymupdf.Matrix(zoom, zoom)
            
            pix = page.get_pixmap(matrix=mat, alpha=False)
            return pix.tobytes(output="png")
        finally:
            doc.close()

