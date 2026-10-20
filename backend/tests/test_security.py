"""Tests for security.py — input validation, secret scrubbing and session TTL."""

import io
import time
import uuid

import pytest
from werkzeug.datastructures import FileStorage

import security
from security import (
    MAX_QUERY_LENGTH,
    MAX_CONCURRENT_SESSIONS,
    SESSION_TTL_SECONDS,
    sanitize_query,
    validate_groq_api_key,
    validate_pdf_file,
    validate_query,
    validate_session_id,
    scrub_secrets,
    touch_session,
    is_session_expired,
    check_session_capacity,
)


# ─── validate_session_id ──────────────────────────────────────────────────────

def test_valid_uuid4_session_id():
    assert validate_session_id(str(uuid.uuid4())) is True


def test_uuid4_is_case_insensitive():
    assert validate_session_id(str(uuid.uuid4()).upper()) is True


def test_default_session_id_allowed():
    assert validate_session_id("default") is True


def test_non_uuid_session_id_rejected():
    assert validate_session_id("not-a-uuid") is False
    assert validate_session_id("12345") is False
    assert validate_session_id("") is False


def test_uuid1_is_rejected():
    # uuid1 is a valid UUID but not v4 — the regex must reject it.
    assert validate_session_id(str(uuid.uuid1())) is False


# ─── validate_query ───────────────────────────────────────────────────────────

def test_empty_query_rejected():
    assert validate_query("")[0] is False
    assert validate_query("   ")[0] is False
    assert validate_query(None)[0] is False


def test_normal_query_accepted():
    ok, err = validate_query("What is the attention mechanism?")
    assert ok is True
    assert err == ""


def test_query_at_length_limit_accepted():
    assert validate_query("a" * MAX_QUERY_LENGTH)[0] is True


def test_query_over_length_limit_rejected():
    ok, err = validate_query("a" * (MAX_QUERY_LENGTH + 1))
    assert ok is False
    assert str(MAX_QUERY_LENGTH) in err


# ─── sanitize_query ───────────────────────────────────────────────────────────

def test_sanitize_strips_script_blocks():
    cleaned = sanitize_query("hello <script>alert('xss')</script> world")
    assert "<script" not in cleaned.lower()
    assert "alert" not in cleaned
    assert cleaned == "hello  world"


def test_sanitize_strips_html_tags():
    assert sanitize_query("<b>bold</b> text") == "bold text"


def test_sanitize_trims_whitespace():
    assert sanitize_query("   spaced   ") == "spaced"


# ─── validate_groq_api_key ────────────────────────────────────────────────────

def test_valid_groq_key_accepted():
    ok, err = validate_groq_api_key("gsk_" + "a" * 32)
    assert ok is True
    assert err == ""


def test_missing_groq_key_rejected():
    assert validate_groq_api_key(None)[0] is False
    assert validate_groq_api_key("")[0] is False


def test_wrong_prefix_rejected():
    assert validate_groq_api_key("sk_" + "a" * 32)[0] is False


def test_too_short_groq_key_rejected():
    assert validate_groq_api_key("gsk_short")[0] is False


# ─── scrub_secrets ────────────────────────────────────────────────────────────

def test_scrub_groq_key():
    scrubbed = scrub_secrets("error with key gsk_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
    assert "gsk_" not in scrubbed
    assert "[REDACTED_SECRET]" in scrubbed


def test_scrub_github_token():
    scrubbed = scrub_secrets("token=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
    assert "ghp_" not in scrubbed


def test_scrub_bearer_token():
    scrubbed = scrub_secrets("Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123")
    assert "Bearer" not in scrubbed


def test_scrub_leaves_plain_text_untouched():
    assert scrub_secrets("just a normal message") == "just a normal message"


def test_scrub_non_string_passthrough():
    assert scrub_secrets(None) is None


# ─── validate_pdf_file ────────────────────────────────────────────────────────

def _file(stream: bytes, filename: str) -> FileStorage:
    return FileStorage(stream=io.BytesIO(stream), filename=filename)


def test_valid_pdf_accepted():
    ok, err = validate_pdf_file(_file(b"%PDF-1.7\n...", "paper.pdf"))
    assert ok is True
    assert err == ""


def test_non_pdf_extension_rejected():
    ok, err = validate_pdf_file(_file(b"%PDF-1.7", "notes.txt"))
    assert ok is False
    assert ".pdf" in err


def test_bad_magic_bytes_rejected():
    ok, err = validate_pdf_file(_file(b"PK\x03\x04 not a pdf", "paper.pdf"))
    assert ok is False


def test_pdf_stream_is_rewound_after_check():
    fs = _file(b"%PDF-1.7\ncontent", "paper.pdf")
    validate_pdf_file(fs)
    # Downstream parsing must be able to read the whole file from position 0.
    assert fs.read() == b"%PDF-1.7\ncontent"


# ─── Session TTL & capacity ───────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _clean_session_timestamps():
    """Keep the module-level session registry isolated between tests."""
    snapshot = dict(security.session_timestamps)
    security.session_timestamps.clear()
    yield
    security.session_timestamps.clear()
    security.session_timestamps.update(snapshot)


def test_untracked_session_not_expired():
    assert is_session_expired("never-seen") is False


def test_freshly_touched_session_not_expired():
    touch_session("s1")
    assert is_session_expired("s1") is False


def test_stale_session_is_expired():
    security.session_timestamps["s2"] = time.time() - SESSION_TTL_SECONDS - 1
    assert is_session_expired("s2") is True


def test_capacity_available_when_empty():
    assert check_session_capacity() is True


def test_capacity_exhausted_at_max():
    for i in range(MAX_CONCURRENT_SESSIONS):
        security.session_timestamps[f"sess-{i}"] = time.time()
    assert check_session_capacity() is False
