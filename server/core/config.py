"""
Shared application config. Loaded once here instead of every service
calling load_dotenv()/os.getenv() separately.
"""

import os
from dotenv import load_dotenv

load_dotenv()

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
MISTRAL_MODEL = os.getenv("MISTRAL_MODEL", "mistral-large-latest")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", os.path.join(BASE_DIR, "uploads"))
GENERATED_FOLDER = os.getenv("GENERATED_FOLDER", os.path.join(BASE_DIR, "generated"))

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(GENERATED_FOLDER, exist_ok=True)

# Comma-separated list of allowed origins. Kept explicit (rather than a
# bare "*") because the API is called with credentials: true, and
# browsers reject a wildcard origin on credentialed requests.
_raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000")
CORS_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

MAX_UPLOAD_MB = float(os.getenv("MAX_UPLOAD_MB", "20"))

# Sessions inactive for longer than this are evicted from memory so a
# long-running server doesn't leak session state forever.
SESSION_TTL_MINUTES = float(os.getenv("SESSION_TTL_MINUTES", "120"))