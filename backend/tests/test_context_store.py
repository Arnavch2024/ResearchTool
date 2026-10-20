"""Tests for rag.context_store — page-level BM25 retrieval (vectorless mode)."""

from rag.context_store import ContextStore


def _short_pages():
    return [
        {"page": 1, "text": "Introduction to transformers and attention mechanisms in NLP."},
        {"page": 2, "text": "The training procedure uses the Adam optimizer and dropout."},
        {"page": 3, "text": "Results on the benchmark dataset demonstrate strong performance."},
    ]


def _long_pages():
    # Each page ~1800 chars so the doc exceeds max_chars=2000 (forces BM25 path)
    # while still fitting a single page inside the budget.
    return [
        {"page": 1, "text": "alpha " * 300},
        {"page": 2, "text": "beta " * 300},
        {"page": 3, "text": "gamma " * 300},
    ]


def test_unbuilt_store_returns_no_results():
    store = ContextStore()
    assert store.search("anything") == []
    assert store.is_ready() is False


def test_build_marks_store_ready():
    store = ContextStore()
    store.build(_short_pages(), "full text")
    assert store.is_ready() is True


def test_blank_pages_are_dropped():
    store = ContextStore()
    store.build(
        [{"page": 1, "text": "real content here"}, {"page": 2, "text": "   \n  "}],
        "",
    )
    assert [p["page"] for p in store.pages] == [1]


def test_short_document_returns_all_pages_in_order():
    store = ContextStore()
    store.build(_short_pages(), "full text")

    results = store.search("attention")
    assert [r["id"] for r in results] == [1, 2, 3]
    assert all(r["score"] == 1.0 for r in results)


def test_short_document_respects_top_k():
    store = ContextStore()
    store.build(_short_pages(), "full text")
    assert [r["id"] for r in store.search("attention", top_k=2)] == [1, 2]


def test_long_document_ranks_relevant_page_first_when_top_k_given():
    store = ContextStore()
    store.build(_long_pages(), "full text")

    results = store.search("beta", top_k=1, max_chars=2000)
    assert len(results) == 1
    assert results[0]["id"] == 2


def test_long_document_scores_are_numeric():
    store = ContextStore()
    store.build(_long_pages(), "full text")

    results = store.search("gamma", top_k=2, max_chars=4000)
    assert results
    assert all(isinstance(r["score"], float) for r in results)


def test_search_for_architecture_falls_back_to_first_pages():
    store = ContextStore()
    # Not built → fallback path (no pages available → empty).
    assert store.search_for_architecture("pipeline", top_k=3) == []


def test_search_for_architecture_ranks_relevant_page_first():
    store = ContextStore()
    store.build(_long_pages(), "full text")

    results = store.search_for_architecture("gamma", top_k=1)
    assert len(results) == 1
    assert results[0]["id"] == 3


def test_search_result_shape_matches_vector_store_contract():
    store = ContextStore()
    store.build(_short_pages(), "full text")
    for item in store.search("dataset"):
        assert set(item.keys()) == {"id", "text", "score"}
