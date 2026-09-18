"""
rag — Retrieval-Augmented Generation pipeline.

Modules:
  parser        — PDF text extraction + visual element detection via PyMuPDF
  splitter      — LangChain recursive text chunking
  vectorstore   — FAISS cosine-similarity vector index + sentence-transformers embeddings
  context_store — BM25 page-level context store for vectorless RAG (visual PDFs)
  reranker      — BM25 fusion + CrossEncoder two-stage reranking
  pipeline      — End-to-end RAG: retrieve → rerank → generate (Groq LLM)
                  Supports both vector (chunk-level) and vectorless (page-level) modes
"""
