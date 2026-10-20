"""
rag — Retrieval-Augmented Generation pipeline.

Modules:
  config        — model identifiers + shared Groq client factory
  parser        — PDF text extraction + visual element detection via PyMuPDF
  splitter      — LangChain recursive text chunking
  text_utils    — shared BM25 tokenizer
  vectorstore   — FAISS cosine-similarity vector index + sentence-transformers embeddings
  context_store — BM25 page-level context store for vectorless RAG (visual PDFs)
  reranker      — BM25 fusion + CrossEncoder two-stage reranking
  prompts       — system prompts + shared prompt assembly
  pipeline      — End-to-end RAG: retrieve → rerank → generate (Groq LLM)
                  Supports both vector (chunk-level) and vectorless (page-level) modes
"""
