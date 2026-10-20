"""Tests for rag.config — model identifiers and the shared Groq client factory."""

import pytest
from groq import Groq

import rag.config as config


def test_model_ids_are_configured_and_distinct():
    assert config.LLM_MODEL
    assert config.FAST_MODEL
    assert config.LLM_MODEL != config.FAST_MODEL


def test_get_groq_builds_client_from_explicit_key():
    assert isinstance(config.get_groq("gsk_" + "a" * 30), Groq)


def test_get_groq_ignores_blank_explicit_key(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_" + "b" * 30)
    monkeypatch.setattr(config, "_groq_client", None)
    # A whitespace-only key must fall through to the env key, not raise.
    assert isinstance(config.get_groq("   "), Groq)


def test_get_groq_raises_without_any_key(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.setattr(config, "_groq_client", None)
    with pytest.raises(ValueError):
        config.get_groq()


def test_get_groq_caches_the_env_client(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_" + "c" * 30)
    monkeypatch.setattr(config, "_groq_client", None)
    assert config.get_groq() is config.get_groq()
