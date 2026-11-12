import os
import shutil

class Config:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    
    # Deteksi lingkungan serverless Vercel / AWS Lambda
    IS_VERCEL = bool(os.environ.get('VERCEL') or os.environ.get('AWS_LAMBDA_FUNCTION_NAME'))
    
    # Storage folders: Pada Vercel hanya /tmp yang memiliki izin write
    STORAGE_ROOT = '/tmp' if IS_VERCEL else BASE_DIR
    
    UPLOAD_FOLDER = os.path.join(STORAGE_ROOT, 'uploads')
    PROJECTS_FOLDER = os.path.join(STORAGE_ROOT, 'projects')
    EXPORTS_FOLDER = os.path.join(STORAGE_ROOT, 'exports')
    
    # 100 MB max upload limit (Vercel serverless membatasi max request body ~4.5 MB)
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024
    
    # Allowed extensions
    ALLOWED_EXTENSIONS = {'pdf', 'pptx', 'ppt'}
    
    # Flask settings
    SECRET_KEY = os.environ.get('SECRET_KEY', 'free-corat-coret-ppt-secret-2026')
    DEBUG = os.environ.get('FLASK_DEBUG', 'False').lower() in ('true', '1') if IS_VERCEL else os.environ.get('FLASK_DEBUG', 'True').lower() in ('true', '1')
    
    @classmethod
    def get_libreoffice_path(cls):
        """Auto-detect LibreOffice / soffice binary across OS platforms."""
        # Check custom environment variable
        custom_path = os.environ.get('LIBREOFFICE_PATH')
        if custom_path and os.path.isfile(custom_path):
            return custom_path
            
        # Check system PATH
        for cmd in ['libreoffice', 'soffice']:
            found = shutil.which(cmd)
            if found:
                return found
                
        # Common Windows paths
        win_candidates = [
            r'C:\Program Files\LibreOffice\program\soffice.exe',
            r'C:\Program Files (x86)\LibreOffice\program\soffice.exe',
            os.path.expandvars(r'%LOCALAPPDATA%\Programs\LibreOffice\program\soffice.exe'),
        ]
        for path in win_candidates:
            if os.path.isfile(path):
                return path
                
        # Common Linux / macOS paths
        nix_candidates = [
            '/usr/bin/libreoffice',
            '/usr/bin/soffice',
            '/usr/local/bin/soffice',
            '/Applications/LibreOffice.app/Contents/MacOS/soffice'
        ]
        for path in nix_candidates:
            if os.path.isfile(path):
                return path
                
        return None

    @classmethod
    def init_folders(cls):
        """Ensure all required storage directories exist."""
        for folder in [cls.UPLOAD_FOLDER, cls.PROJECTS_FOLDER, cls.EXPORTS_FOLDER]:
            try:
                os.makedirs(folder, exist_ok=True)
            except OSError:
                pass
