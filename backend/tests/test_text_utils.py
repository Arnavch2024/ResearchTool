"""Tests for rag.text_utils — the shared BM25 tokenizer."""

from rag.text_utils import tokenize


def test_lowercases_input():
    assert tokenize("Attention MECHANISM") == ["attention", "mechanism"]


def test_punctuation_is_a_boundary():
    assert tokenize("self-attention, layer.") == ["self", "attention", "layer"]


def test_drops_single_character_tokens():
    assert tokenize("a b c deep learning") == ["deep", "learning"]


def test_empty_and_none_are_safe():
    assert tokenize("") == []
    assert tokenize(None) == []


def test_notation_and_citations_normalised():
    assert tokenize("(Zhang et al., 2023) [12]") == ["zhang", "et", "al", "2023", "12"]
