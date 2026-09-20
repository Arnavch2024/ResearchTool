"""
security.py — Centralized security hardening for Research RAG.

Covers:
  • Rate limiting  (flask-limiter, in-memory)
  • Security headers  (custom after_request)
  • Input validation  (query length, file type, session ID format)
  • Session TTL & cleanup  (background daemon thread)
"""

import re
import time
import threading
from functools import wraps
from flask import request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# ─── Constants ────────────────────────────────────────────────────────────────

MAX_QUERY_LENGTH = 2000
SESSION_TTL_SECONDS = 30 * 60          # 30 minutes
MAX_CONCURRENT_SESSIONS = 50
CLEANUP_INTERVAL_SECONDS = 5 * 60      # run cleanup every 5 min
ALLOWED_ORIGINS = [
    "http://localhost:5173",            # Vite dev server
    "http://127.0.0.1:5173",
]

# UUID v4 pattern
_UUID4_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

# PDF magic bytes: %PDF
_PDF_MAGIC = b"%PDF"

# Patterns for sanitising user input before it reaches the LLM
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_SCRIPT_RE = re.compile(r"<script[\s\S]*?</script>", re.IGNORECASE)


# ─── Rate Limiter ─────────────────────────────────────────────────────────────

def create_limiter(app):
    """Attach flask-limiter to the app and return the limiter instance."""
    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=["60 per minute"],
        storage_uri="memory://",
        strategy="fixed-window",
    )

    # Custom 429 handler
    @app.errorhandler(429)
    def rate_limit_exceeded(e):
        return jsonify({
            "error": "Rate limit exceeded. Please slow down.",
            "retry_after": e.description,
        }), 429

    return limiter


# Groq API Key pattern
_GROQ_KEY_RE = re.compile(r"^gsk_[a-zA-Z0-9_\-]{20,128}$")

# Pattern to scrub sensitive keys from logs and error messages
_SECRET_SCRUB_RE = re.compile(
    r"(gsk_[a-zA-Z0-9_\-]{16,}|ghp_[a-zA-Z0-9_\-]{16,}|Bearer\s+[a-zA-Z0-9_\-\.]{20,})",
    re.IGNORECASE,
)


def scrub_secrets(text: str) -> str:
    """Redact any API keys, tokens, or JWTs from text, logs, or error responses."""
    if not text or not isinstance(text, str):
        return text
    return _SECRET_SCRUB_RE.sub("[REDACTED_SECRET]", text)


def validate_groq_api_key(api_key: str | None) -> tuple[bool, str]:
    """Validate format of provided Groq API key."""
    if not api_key:
        return False, "API key is required."
    clean = api_key.strip()
    if not _GROQ_KEY_RE.match(clean):
        return False, "Invalid Groq API key format. Key must start with 'gsk_' and contain only alphanumeric characters."
    return True, ""


# ─── Security Headers ────────────────────────────────────────────────────────

def register_security_headers(app):
    """Add security headers to every response."""

    @app.after_request
    def _add_security_headers(response):
        # Prevent MIME-type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        # XSS filter (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # Referrer policy (never leak headers or URLs on cross-origin navigation)
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Disable dangerous browser features
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )
        # Content Security Policy (allows safe dynamic preview execution, font/script CDNs, and API connections)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self' http://localhost:* ws://localhost:*; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdnjs.cloudflare.com blob:; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "img-src 'self' data: blob: https:; "
            "connect-src 'self' http://localhost:* ws://localhost:* https://api.groq.com; "
            "frame-src 'self' data: blob:; "
            "child-src 'self' data: blob:;"
        )
        # CORS allowed headers
        response.headers["Access-Control-Allow-Headers"] = (
            "Content-Type, Authorization, X-Groq-Api-Key, X-Api-Key"
        )
        # Inform proxies that responses vary by user key and auth
        response.headers["Vary"] = "Authorization, X-Groq-Api-Key, Accept-Encoding"

        # Prevent caching of API responses (zero leak guarantee)
        if request.path.startswith("/api"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response


# ─── Input Validation Helpers ─────────────────────────────────────────────────

def validate_session_id(session_id: str) -> bool:
    """Check that session_id is a valid UUID v4."""
    return bool(_UUID4_RE.match(session_id)) if session_id != "default" else True


def validate_query(query: str) -> tuple[bool, str]:
    """Validate a chat query. Returns (is_valid, error_message)."""
    if not query or not query.strip():
        return False, "Empty query"
    if len(query) > MAX_QUERY_LENGTH:
        return False, f"Query too long ({len(query)} chars). Maximum is {MAX_QUERY_LENGTH}."
    return True, ""


def sanitize_query(query: str) -> str:
    """Strip HTML tags and script injections from user input."""
    q = _SCRIPT_RE.sub("", query)
    q = _HTML_TAG_RE.sub("", q)
    return q.strip()


def validate_pdf_file(file_storage) -> tuple[bool, str]:
    """
    Validate an uploaded file is actually a PDF.
    Checks both the filename extension and magic bytes.
    Resets the file stream position after reading.
    """
    # Extension check
    filename = file_storage.filename or ""
    if not filename.lower().endswith(".pdf"):
        return False, "Only PDF files are allowed. Please upload a .pdf file."

    # Magic-bytes check
    header = file_storage.read(8)
    file_storage.seek(0)  # reset for downstream processing
    if not header.startswith(_PDF_MAGIC):
        return False, "File does not appear to be a valid PDF (invalid header)."

    return True, ""


# ─── Session TTL & Cleanup ────────────────────────────────────────────────────

# Shared dict tracking last-access time per session
session_timestamps: dict[str, float] = {}


def touch_session(session_id: str):
    """Update last-accessed timestamp for a session."""
    session_timestamps[session_id] = time.time()


def is_session_expired(session_id: str) -> bool:
    """Check whether a session has exceeded its TTL."""
    ts = session_timestamps.get(session_id)
    if ts is None:
        return False  # never tracked → not expired
    return (time.time() - ts) > SESSION_TTL_SECONDS


def start_session_cleanup(stores, context_stores, rag_modes, chat_histories):
    """
    Launch a background daemon thread that periodically purges expired sessions.
    Runs every CLEANUP_INTERVAL_SECONDS.
    """

    def _cleanup_loop():
        while True:
            time.sleep(CLEANUP_INTERVAL_SECONDS)
            now = time.time()
            expired = [
                sid for sid, ts in list(session_timestamps.items())
                if (now - ts) > SESSION_TTL_SECONDS
            ]
            for sid in expired:
                stores.pop(sid, None)
                context_stores.pop(sid, None)
                rag_modes.pop(sid, None)
                chat_histories.pop(sid, None)
                session_timestamps.pop(sid, None)
            if expired:
                print(f"[security] Cleaned up {len(expired)} expired session(s)")

    t = threading.Thread(target=_cleanup_loop, daemon=True, name="session-cleanup")
    t.start()


def check_session_capacity() -> bool:
    """Return True if we can accept another session."""
    return len(session_timestamps) < MAX_CONCURRENT_SESSIONS
