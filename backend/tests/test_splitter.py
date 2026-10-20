"""Tests for rag.splitter — chunking behaviour and metadata shape."""

from rag.splitter import split_text

# ~2700 chars of prose → several chunks at the default 1100-char size.
_LONG_TEXT = ("This is a sentence about retrieval augmented generation. " * 50)


def test_returns_chunks_with_index_metadata():
    chunks = split_text("Short paragraph.\n\nAnother paragraph.")
    assert chunks
    for i, chunk in enumerate(chunks):
        assert set(chunk.keys()) == {"id", "text"}
        assert chunk["id"] == i
        assert isinstance(chunk["text"], str)


def test_short_text_is_a_single_chunk():
    assert len(split_text("Just one small paragraph.")) == 1


def test_ids_are_sequential_and_text_non_empty():
    chunks = split_text(_LONG_TEXT)
    assert [c["id"] for c in chunks] == list(range(len(chunks)))
    assert all(c["text"].strip() for c in chunks)


def test_custom_chunk_size_is_respected():
    chunks = split_text(_LONG_TEXT, chunk_size=200, chunk_overlap=0)
    assert len(chunks) > 1
    # RecursiveCharacterTextSplitter never exceeds chunk_size for plain text.
    assert all(len(c["text"]) <= 200 for c in chunks)


def test_does_not_mutate_input():
    original = "Paragraph one.\n\nParagraph two."
    snapshot = str(original)
    split_text(original)
    assert original == snapshot
