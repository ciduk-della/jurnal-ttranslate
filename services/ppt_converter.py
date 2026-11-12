import os
import subprocess
import logging
from config import Config

logger = logging.getLogger(__name__)

class PPTConversionError(Exception):
    """Custom exception for PPT/PPTX conversion errors."""
    pass

class LibreOfficeNotFoundError(PPTConversionError):
    """Raised when LibreOffice binary is not installed or detected."""
    pass

class PPTConverter:
    @staticmethod
    def is_libreoffice_available() -> bool:
        """Check whether LibreOffice CLI is available."""
        return Config.get_libreoffice_path() is not None

    @classmethod
    def convert_to_pdf(cls, input_path: str, output_dir: str) -> str:
        """
        Convert a PPT or PPTX file to PDF using LibreOffice headless mode.
        Returns the path to the converted PDF file.
        """
        if not os.path.exists(input_path):
            raise PPTConversionError(f"File tidak ditemukan: {input_path}")

        ext = os.path.splitext(input_path)[1].lower()
        if ext not in ['.pptx', '.ppt']:
            raise PPTConversionError(f"Format {ext} tidak didukung untuk konversi presentasi.")

        libreoffice_bin = Config.get_libreoffice_path()
        if not libreoffice_bin:
            install_msg = (
                "LibreOffice tidak ditemukan pada sistem. "
                "Untuk mengonversi file PowerPoint (.pptx / .ppt) secara otomatis, "
                "silakan pasang LibreOffice terlebih dahulu (misal: 'winget install TheDocumentFoundation.LibreOffice' "
                "atau unduh dari https://www.libreoffice.org/). "
                "Sebagai alternatif cepat, Anda dapat mengekspor presentasi langsung ke format PDF dari PowerPoint dan mengunggahnya."
            )
            logger.warning(install_msg)
            raise LibreOfficeNotFoundError(install_msg)

        os.makedirs(output_dir, exist_ok=True)
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        expected_pdf = os.path.join(output_dir, f"{base_name}.pdf")

        # LibreOffice command
        # Use a distinct temporary UserInstallation to avoid profile lock issues in multi-threaded/concurrent server runs
        temp_profile_dir = os.path.join(output_dir, f".lo_profile_{base_name}")
        clean_profile_dir = temp_profile_dir.replace('\\', '/')
        profile_param = f"-env:UserInstallation=file:///{clean_profile_dir}"

        cmd = [
            libreoffice_bin,
            "--headless",
            "--invisible",
            "--nodefault",
            "--nofirststartwizard",
            "--nolockcheck",
            "--nologo",
            profile_param,
            "--convert-to",
            "pdf",
            "--outdir",
            output_dir,
            input_path
        ]

        logger.info(f"Menjalankan konversi LibreOffice: {' '.join(cmd)}")
        try:
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=90  # 90 seconds timeout
            )
            
            if result.returncode != 0:
                stderr_output = result.stderr.strip() or result.stdout.strip()
                if ext == '.ppt':
                    msg = (
                        f"Gagal mengonversi file PPT format lawas: {stderr_output}. "
                        "Format PPT biner lama mungkin memiliki proteksi atau struktur yang tidak kompatibel. "
                        "Silakan simpan ulang sebagai PPTX atau ekspor langsung ke PDF dari PowerPoint."
                    )
                else:
                    msg = f"LibreOffice gagal mengonversi file: {stderr_output or 'Unknown error'}"
                logger.error(msg)
                raise PPTConversionError(msg)

            if not os.path.exists(expected_pdf):
                raise PPTConversionError(
                    "Proses konversi selesai tetapi file PDF tidak ditemukan di direktori output."
                )

            logger.info(f"Konversi berhasil: {expected_pdf}")
            return expected_pdf

        except subprocess.TimeoutExpired:
            logger.error("Proses konversi LibreOffice melebihi batas waktu (timeout 90 detik).")
            raise PPTConversionError("Konversi presentasi melebihi batas waktu. File mungkin terlalu besar atau kompleks.")
        except Exception as e:
            if isinstance(e, PPTConversionError):
                raise
            logger.exception("Error tak terduga saat menjalankan konversi LibreOffice:")
            raise PPTConversionError(f"Terjadi kesalahan saat memproses konversi: {str(e)}")
        finally:
            # Clean up temporary libreoffice user profile directory if created
            if os.path.exists(temp_profile_dir):
                try:
                    import shutil
                    shutil.rmtree(temp_profile_dir, ignore_errors=True)
                except Exception:
                    pass

