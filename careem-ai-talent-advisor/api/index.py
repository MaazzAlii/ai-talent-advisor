"""
Vercel Function entrypoint. Vercel's Python runtime detects the `app` object exported
here and treats this whole file as a single ASGI serverless function. All backend logic
lives in app/main.py -- this file only exists to give Vercel a stable, documented
location to find it at (api/index.py is the conventional entrypoint path).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app  # noqa: E402
