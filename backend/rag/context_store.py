"""
Vectorless context store — BM25 page-level retrieval.

For PDFs with visual elements (images, diagrams, drawings) that embeddings
cannot capture, this store preserves the full page structure and uses
lightweight BM25 lexical ranking to select the most relevant pages.

Interface mirrors VectorStore so the rest of the app can treat both
interchangeably.
"""

from rank_bm25 import BM25Okapi


class ContextStore:
    """Page-level context store using BM25 ranking (no embeddings)."""

    def __init__(self):
        self.pages: list[dict] = []       # [{page: 1, text: "..."}, ...]
        self.full_text: str = ""
        self.bm25 = None
        self._ready = False

    def build(self, pages: list[dict], full_text: str):
        """Index page texts for BM25 retrieval.

        Args:
            pages: list of {page: int, text: str} from parser output
            full_text: concatenated full document text
        """
        self.pages = [p for p in pages if p["text"].strip()]
        self.full_text = full_text

        if self.pages:
            tokenized = [p["text"].lower().split() for p in self.pages]
            self.bm25 = BM25Okapi(tokenized)

        self._ready = True

    def search(self, query: str, max_chars: int = 120_000) -> list[dict]:
        """Select the most relevant pages up to max_chars.

        For short documents (total text < max_chars), returns ALL pages
        in document order — no information is lost.

        For longer documents, BM25-ranks pages by relevance and fills
        the context window greedily.

        Returns:
            List of {id: page_number, text: page_text, score: bm25_score}
            Same shape as VectorStore.search() for compatibility.
        """
        if not self._ready or not self.pages:
            return []

        total_len = sum(len(p["text"]) for p in self.pages)

        # Short doc — return everything in document order
        if total_len <= max_chars:
            return [
                {"id": p["page"], "text": p["text"], "score": 1.0}
                for p in self.pages
            ]

        # Long doc — BM25 rank, then fill greedily
        if self.bm25 is None:
            return []

        scores = self.bm25.get_scores(query.lower().split())

        scored_pages = []
        for i, page in enumerate(self.pages):
            scored_pages.append({
                "idx": i,
                "page": page["page"],
                "text": page["text"],
                "score": float(scores[i]),
            })

        # Sort by BM25 score descending
        scored_pages.sort(key=lambda x: x["score"], reverse=True)

        # Fill up to max_chars
        selected = []
        char_count = 0
        for sp in scored_pages:
            if char_count + len(sp["text"]) > max_chars:
                continue
            selected.append(sp)
            char_count += len(sp["text"])

        # Re-sort selected pages by document order for coherent reading
        selected.sort(key=lambda x: x["idx"])

        return [
            {"id": s["page"], "text": s["text"], "score": s["score"]}
            for s in selected
        ]

    def search_for_architecture(self, query: str, top_k: int = 5) -> list[dict]:
        """Select top_k pages most relevant to architecture queries.

        Used by the architecture diagram generator — returns a smaller
        set of highly relevant pages.
        """
        if not self._ready or not self.pages or self.bm25 is None:
            # Fallback: return first few pages
            return [
                {"id": p["page"], "text": p["text"], "score": 1.0}
                for p in self.pages[:top_k]
            ]

        scores = self.bm25.get_scores(query.lower().split())
        scored = [
            {"id": self.pages[i]["page"], "text": self.pages[i]["text"],
             "score": float(scores[i])}
            for i in range(len(self.pages))
        ]
        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]

    def is_ready(self) -> bool:
        return self._ready
