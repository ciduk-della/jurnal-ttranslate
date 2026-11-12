import os
# Fix OpenBLAS crash on Windows
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

import logging
from flask import Flask, render_template, jsonify
from config import Config
from routes.upload import upload_bp
from routes.project import project_bp
from routes.export import export_bp
from routes.translator import translator_bp

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger('free-corat-coret-ppt')

def create_app():
    base_dir = os.path.abspath(os.path.dirname(__file__))
    app = Flask(
        __name__,
        static_folder=os.path.join(base_dir, 'static'),
        template_folder=os.path.join(base_dir, 'templates')
    )
    app.config.from_object(Config)

    # Initialize folders
    Config.init_folders()

    # Register blueprints
    app.register_blueprint(upload_bp)
    app.register_blueprint(project_bp)
    app.register_blueprint(export_bp)
    app.register_blueprint(translator_bp)

    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/translator')
    def translator():
        return render_template('translator.html')

    @app.route('/api/health')
    def health():
        return jsonify({
            "status": "healthy",
            "app": "Free Corat-Coret PPT",
            "version": "1.0.0"
        })

    @app.errorhandler(413)
    def request_entity_too_large(error):
        return jsonify({
            "status": "error",
            "message": f"Ukuran file melebihi batas maksimal ({Config.MAX_CONTENT_LENGTH // (1024 * 1024)} MB)."
        }), 413

    @app.errorhandler(404)
    def page_not_found(error):
        return jsonify({
            "status": "error",
            "message": "Endpoint atau resource tidak ditemukan."
        }), 404

    @app.errorhandler(500)
    def internal_server_error(error):
        return jsonify({
            "status": "error",
            "message": "Terjadi kesalahan internal pada server."
        }), 500

    return app

if __name__ == '__main__':
    import socket
    app = create_app()
    port = int(os.environ.get('PORT', 5000))
    
    # Deteksi IP lokal untuk akses dari perangkat lain (HP/tablet)
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        local_ip = '127.0.0.1'

    logger.info(f"Free Corat-Coret PPT aktif di:")
    logger.info(f"  - Laptop/PC: http://127.0.0.1:{port}")
    logger.info(f"  - HP/Tablet: http://{local_ip}:{port}")
    
    # Bind ke 0.0.0.0 agar dapat diakses dari jaringan Wi-Fi lokal
    # use_reloader=False untuk mencegah crash OpenBLAS pada Python 3.14 Windows
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)

