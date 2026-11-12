import os
import sys

# Tambahkan direktori root aplikasi ke sys.path
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from app import create_app

# Ekspor instance WSGI untuk Vercel Serverless Function
app = create_app()
