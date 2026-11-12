import os
import sys
import traceback

# Tambahkan direktori root dan direktori saat ini ke sys.path
current_dir = os.path.dirname(__file__)
root_dir = os.path.abspath(os.path.join(current_dir, '..'))

for p in [root_dir, current_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

class VercelWSGIMiddleware:
    """
    Middleware untuk menangani perubahan routing rewrite internal pada Vercel CLI 65+.
    Ketika Vercel me-rewrite request ke /api/index, middleware ini mengembalikan
    PATH_INFO ke URL asli yang diminta pengguna agar routing Flask bekerja normal.
    """
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        path_info = environ.get('PATH_INFO', '')
        
        # Cek apakah Vercel mengubah PATH_INFO menjadi /api/index
        if path_info in ('/api/index', '/api/index/'):
            # Ambil original URI dari header HTTP Vercel
            orig = (
                environ.get('HTTP_X_FORWARDED_URI') or
                environ.get('HTTP_X_MATCHED_PATH') or
                environ.get('RAW_URI') or
                environ.get('REQUEST_URI') or
                ''
            ).split('?')[0]
            
            if orig and orig not in ('/api/index', '/api/index/'):
                environ['PATH_INFO'] = orig
            else:
                environ['PATH_INFO'] = '/'
        elif path_info.startswith('/api/index/'):
            # Tangani jika path diteruskan sebagai /api/index/nama_route
            environ['PATH_INFO'] = path_info[len('/api/index'):]

        return self.wsgi_app(environ, start_response)

try:
    from app import create_app
    raw_app = create_app()
    # Terapkan middleware untuk memulihkan rute asli pada lingkungan serverless
    raw_app.wsgi_app = VercelWSGIMiddleware(raw_app.wsgi_app)
    app = raw_app
except Exception as e:
    # Tangkap error startup dan tampilkan langsung di browser agar mudah didebug
    from flask import Flask
    error_detail = traceback.format_exc()
    print("FATAL STARTUP ERROR:", error_detail, file=sys.stderr)
    
    app = Flask(__name__)
    
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def debug_error(path):
        return f"""
        <html>
        <head><title>Startup Error</title></head>
        <body style="font-family: monospace; padding: 20px; background: #1e1e1e; color: #ff6b6b;">
            <h2>❌ Startup Error pada Vercel</h2>
            <p>Terjadi kesalahan saat memuat modul aplikasi:</p>
            <pre style="background: #2d2d2d; color: #fff; padding: 15px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap;">{error_detail}</pre>
        </body>
        </html>
        """, 500
