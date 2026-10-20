"""Tests for rag.prompts — system prompt constants and shared assembly."""

from rag.prompts import (
    RAG_SYSTEM_PROMPT,
    VECTORLESS_SYSTEM_PROMPT,
    build_context_prompt,
)


def test_system_prompts_are_non_empty_strings():
    assert isinstance(RAG_SYSTEM_PROMPT, str)
    assert isinstance(VECTORLESS_SYSTEM_PROMPT, str)
    assert len(RAG_SYSTEM_PROMPT) > 500
    assert len(VECTORLESS_SYSTEM_PROMPT) > 500


def test_build_context_prompt_returns_system_and_user_messages():
    items = [{"id": 1, "text": "first chunk"}, {"id": 2, "text": "second chunk"}]
    messages = build_context_prompt("What is X?", items, "Chunk", RAG_SYSTEM_PROMPT)

    assert isinstance(messages, tuple)
    assert len(messages) == 2

    system, user = messages
    assert system == {"role": "system", "content": RAG_SYSTEM_PROMPT}
    assert user["role"] == "user"


def test_build_context_prompt_labels_each_item():
    items = [{"id": 1, "text": "alpha"}, {"id": 2, "text": "beta"}]
    _, user = build_context_prompt("q", items, "Chunk", RAG_SYSTEM_PROMPT)

    assert "[Chunk 1]:" in user["content"]
    assert "[Chunk 2]:" in user["content"]
    assert "alpha" in user["content"]
    assert "beta" in user["content"]
    assert "Question: q" in user["content"]


def test_build_context_prompt_omits_external_section_by_default():
    _, user = build_context_prompt("q", [{"id": 1, "text": "t"}], "Chunk", RAG_SYSTEM_PROMPT)
    assert "EXTERNAL SEARCH RESULTS" not in user["content"]


def test_build_context_prompt_includes_external_section_when_given():
    _, user = build_context_prompt(
        "q",
        [{"id": 1, "text": "t"}],
        "Chunk",
        RAG_SYSTEM_PROMPT,
        mcp_context="[ArXiv] Some paper",
    )
    assert "EXTERNAL SEARCH RESULTS" in user["content"]
    assert "[ArXiv] Some paper" in user["content"]


def test_page_label_switches_noun_and_citation_hint():
    _, user = build_context_prompt("q", [{"id": 3, "text": "t"}], "Page", VECTORLESS_SYSTEM_PROMPT)
    assert "Retrieved pages from the uploaded paper" in user["content"]
    assert "[Page N]" in user["content"]


def test_chunk_label_uses_context_noun():
    _, user = build_context_prompt("q", [{"id": 1, "text": "t"}], "Chunk", RAG_SYSTEM_PROMPT)
    assert "Retrieved context from the uploaded paper" in user["content"]
    assert "[Chunk N]" in user["content"]
