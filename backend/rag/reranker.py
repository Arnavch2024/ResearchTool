from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder

_cross_encoder = None

def get_cross_encoder():
    global _cross_encoder
    if _cross_encoder is None:
        _cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    return _cross_encoder


def rerank(query: str, candidates: list[dict], top_k: int = 5) -> list[dict]:
    """
    Two-stage reranking:
    1. BM25 lexical scoring fused with vector scores
    2. Cross-encoder neural reranking on top candidates
    """
    if not candidates:
        return []

    # Stage 1: BM25 lexical reranking
    tokenized_corpus = [c["text"].lower().split() for c in candidates]
    bm25 = BM25Okapi(tokenized_corpus)
    bm25_scores = bm25.get_scores(query.lower().split())

    # Normalize BM25 scores to [0,1]
    bm25_max = max(bm25_scores) if max(bm25_scores) > 0 else 1
    bm25_normalized = [s / bm25_max for s in bm25_scores]

    # Fuse: 0.6 * vector_score + 0.4 * bm25_score
    fused = []
    for i, c in enumerate(candidates):
        fused_score = 0.6 * c.get("score", 0) + 0.4 * bm25_normalized[i]
        fused.append({**c, "fused_score": fused_score})

    # Take top 10 for cross-encoder (expensive step)
    fused.sort(key=lambda x: x["fused_score"], reverse=True)
    top_candidates = fused[:10]

    # Stage 2: Cross-encoder neural reranking
    cross_encoder = get_cross_encoder()
    pairs = [[query, c["text"]] for c in top_candidates]
    ce_scores = cross_encoder.predict(pairs)

    for i, c in enumerate(top_candidates):
        c["ce_score"] = float(ce_scores[i])

    top_candidates.sort(key=lambda x: x["ce_score"], reverse=True)
    return top_candidates[:top_k]
