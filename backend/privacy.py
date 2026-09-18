"""
privacy.py — Privacy guarantees and data-handling transparency for Research RAG.

Covers:
  • Privacy policy endpoint (/api/privacy)
  • PII redaction from prompts (opt-in via PRIVACY_STRIP_PII env var)
  • Privacy response headers
"""

import os
import re
from flask import request

# ─── PII Redaction Patterns ───────────────────────────────────────────────────

# Email: user@example.com
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

# Phone numbers: +1-234-567-8901, (234) 567-8901, 234.567.8901, etc.
_PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[\s\-.]?)?"        # country code
    r"(?:\(?\d{2,4}\)?[\s\-.]?)"       # area code
    r"\d{3,4}[\s\-.]?\d{3,4}"          # number
)

# SSN-like patterns: 123-45-6789
_SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")

# Credit card-like: 16 digits with optional separators
_CC_RE = re.compile(r"\b(?:\d{4}[\s\-]?){3}\d{4}\b")

# IP addresses: 192.168.1.1
_IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")

PII_PATTERNS = [
    (_EMAIL_RE, "[EMAIL_REDACTED]"),
    (_SSN_RE, "[SSN_REDACTED]"),
    (_CC_RE, "[CARD_REDACTED]"),
    (_PHONE_RE, "[PHONE_REDACTED]"),
    (_IP_RE, "[IP_REDACTED]"),
]


# ─── PII Strip ───────────────────────────────────────────────────────────────

def should_strip_pii() -> bool:
    """Check whether PII stripping is enabled via environment variable."""
    return os.environ.get("PRIVACY_STRIP_PII", "true").lower() in ("true", "1", "yes")


def strip_pii(text: str) -> str:
    """
    Remove personally identifiable information from text.
    Only runs if PRIVACY_STRIP_PII env var is truthy.
    Returns original text unchanged if PII stripping is disabled.
    """
    if not should_strip_pii():
        return text

    result = text
    for pattern, replacement in PII_PATTERNS:
        result = pattern.sub(replacement, result)
    return result


# ─── Privacy Policy ──────────────────────────────────────────────────────────

PRIVACY_POLICY = {
    "application": "Research RAG",
    "version": "1.0",
    "llm_provider": {
        "name": "Groq (GroqCloud)",
        "model": "llama-3.3-70b-versatile",
        "training_on_prompts": False,
        "training_on_responses": False,
        "data_retention_by_provider": "none (Groq default: no retention of API inputs/outputs)",
        "provider_privacy_url": "https://groq.com/privacy-policy/",
    },
    "data_handling": {
        "storage_type": "ephemeral (in-memory only)",
        "data_stored_on_disk": False,
        "prompt_logging": False,
        "session_auto_expiry_minutes": 30,
        "data_cleared_on": ["session end", "server restart", "30-minute inactivity"],
    },
    "security_measures": {
        "rate_limiting": True,
        "input_validation": True,
        "input_sanitization": True,
        "pii_redaction": "enabled (auto-strips emails, phone numbers, SSNs, card numbers)",
        "security_headers": True,
        "cors_restricted": True,
        "file_type_validation": "PDF only (magic-byte + extension check)",
    },
    "third_party_data_sharing": False,
    "encryption_in_transit": "TLS (HTTPS when deployed behind a reverse proxy)",
    "user_rights": {
        "delete_data": "Clear session via the UI or DELETE /api/clear/<session_id>",
        "data_portability": "No persistent data is stored to export",
    },
}


def get_privacy_policy() -> dict:
    """Return the privacy policy dict, with live PII-stripping status and model name."""
    policy = PRIVACY_POLICY.copy()
    model_name = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
    policy["llm_provider"] = {
        **PRIVACY_POLICY["llm_provider"],
        "model": model_name,
    }
    policy["security_measures"] = {
        **PRIVACY_POLICY["security_measures"],
        "pii_redaction_active": should_strip_pii(),
    }
    return policy


# ─── Privacy Response Headers ────────────────────────────────────────────────

def register_privacy_headers(app):
    """Add privacy-related headers to every API response."""

    @app.after_request
    def _add_privacy_headers(response):
        if "/api" in request.path:
            response.headers["X-Data-Retention"] = "none"
            response.headers["X-AI-Training"] = "disabled"
            response.headers["X-Privacy-Mode"] = "no-training"
        return response
