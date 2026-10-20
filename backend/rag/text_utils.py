"""Shared lexical helpers for BM25-based retrieval stages."""

import re

# Alphanumeric runs — punctuation and hyphenation are boundaries, so
# "self-attention," and "self attention" tokenize identically.
_TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> list[str]:
    """Lowercase alphanumeric tokenization for BM25 scoring.

    Splitting on punctuation (rather than str.split on whitespace) keeps
    terms like "model," / "model." / "(model)" aligned with the query form,
    which matters a lot for technical papers full of notation and citations.
    Single-character tokens are dropped as they carry little lexical signal.
    """
    return [t for t in _TOKEN_RE.findall((text or "").lower()) if len(t) > 1]
