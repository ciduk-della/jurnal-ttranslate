import os
import sys
import traceback

# Tambahkan direktori root dan direktori saat ini ke sys.path
current_dir = os.path.dirname(__file__)
root_dir = os.path.abspath(os.path.join(current_dir, '..'))

for p in [root_dir, current_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from app import create_app
    app = create_app()
except Exception as e:
    # Tangkap error startup dan tampilkan langsung di halaman web agar mudah didebug
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
