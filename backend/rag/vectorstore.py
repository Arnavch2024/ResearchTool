import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

_model = None

def get_model():
    global _model
    if _model is None:
        # Lightweight but strong embedding model
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


class VectorStore:
    def __init__(self):
        self.chunks = []
        self.index = None
        self.embeddings = None

    def build(self, chunks: list[dict]):
        """Embed chunks and build FAISS index."""
        self.chunks = chunks
        model = get_model()
        texts = [c["text"] for c in chunks]
        self.embeddings = model.encode(texts, show_progress_bar=False, convert_to_numpy=True)

        dim = self.embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dim)  # Inner product = cosine on normalized vecs

        # Normalize for cosine similarity
        norms = np.linalg.norm(self.embeddings, axis=1, keepdims=True)
        normalized = self.embeddings / (norms + 1e-10)
        self.index.add(normalized.astype(np.float32))

    def search(self, query: str, top_k: int = 10) -> list[dict]:
        """Return top_k most similar chunks."""
        model = get_model()
        q_emb = model.encode([query], convert_to_numpy=True)
        q_norm = q_emb / (np.linalg.norm(q_emb, keepdims=True) + 1e-10)

        scores, indices = self.index.search(q_norm.astype(np.float32), top_k)
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < len(self.chunks):
                results.append({**self.chunks[idx], "score": float(score)})
        return results

    def is_ready(self) -> bool:
        return self.index is not None and len(self.chunks) > 0
