"""
RAG pipeline: retrieve → rerank → generate.
Master system prompt covers: paper Q&A, implementation guidance, external source synthesis.
"""
import re
from typing import Optional
from .config import get_groq, LLM_MODEL
from .prompts import (
    RAG_SYSTEM_PROMPT,
    VECTORLESS_SYSTEM_PROMPT,
    build_context_prompt,
)
from .vectorstore import VectorStore
from .context_store import ContextStore
from .reranker import rerank


# ─── Master System Prompt ─────────────────────────────────────────────────────
# Defined in .prompts (shared with the vectorless path) and imported above.


def build_prompt(
    query: str,
    context_chunks: list[dict],
    mcp_context: str = "",
) -> tuple[dict, dict]:
    """Build (system_message, user_message) for Groq chat completion."""
    return build_context_prompt(
        query, context_chunks, "Chunk", RAG_SYSTEM_PROMPT, mcp_context=mcp_context,
    )


def _dedupe_chunks(chunks: list[dict]) -> list[dict]:
    """Drop near-duplicate chunks that arise from overlapping splits.

    Chunks are compared on a whitespace-normalized prefix so paraphrased
    overlap regions (which differ only by surrounding text) collapse.
    """
    seen = set()
    out = []
    for c in chunks:
        key = re.sub(r"\s+", " ", c["text"]).strip().lower()[:280]
        if key and key in seen:
            continue
        seen.add(key)
        out.append(c)
    return out


def _expand_neighbors(top_chunks: list[dict], all_chunks: list[dict], window: int = 1) -> list[dict]:
    """Add the chunks immediately surrounding the top-ranked chunk.

    Answers frequently depend on a sentence that lands just across a chunk
    boundary. Restoring the neighbours of the best chunk keeps that context
    without widening the whole result set. Output is in document order.
    """
    if not top_chunks or not all_chunks:
        return top_chunks
    by_id = {c["id"]: c for c in all_chunks}
    selected = {c["id"] for c in top_chunks}
    best_id = top_chunks[0]["id"]
    for delta in range(-window, window + 1):
        nid = best_id + delta
        if nid in by_id:
            selected.add(nid)
    return [by_id[i] for i in sorted(selected)]


def answer_query(
    query: str,
    vector_store: VectorStore,
    history: list = None,
    mcp_context: str = "",
    api_key: Optional[str] = None,
) -> dict:
    """
    Full RAG pipeline: retrieve → rerank → generate.
    Optionally augments context with external MCP search results.
    Message order: [system] → [history (last 3 turns)] → [user+context]
    """
    # Retrieve
    candidates = _dedupe_chunks(vector_store.search(query, top_k=15))

    # Rerank, then restore the context immediately around the best chunk
    top_chunks = rerank(query, candidates, top_k=5)
    top_chunks = _expand_neighbors(top_chunks, vector_store.chunks)

    # Guard: empty / corrupted PDF
    if not top_chunks:
        return {
            "answer": (
                "I couldn't find relevant context in the uploaded document for your question. "
                "Please try rephrasing, or ensure the PDF contains searchable text."
            ),
            "sources": [],
            "usage": {"prompt_tokens": 0, "completion_tokens": 0},
        }

    # Build messages
    system_msg, user_msg = build_prompt(query, top_chunks, mcp_context=mcp_context)

    messages = [system_msg]
    if history:
        # Keep last 3 turns (6 messages); drop any stale system messages
        messages.extend(m for m in history[-6:] if m.get("role") != "system")
    messages.append(user_msg)

    # Generate
    client = get_groq(api_key=api_key)
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=messages,
        temperature=0.2,
        max_tokens=1024,
    )

    answer = response.choices[0].message.content
    return {
        "answer": answer,
        "sources": [{"id": c["id"], "text": c["text"][:200] + "..."} for c in top_chunks],
        "usage": {
            "prompt_tokens":    response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
        },
    }


# ─── Vectorless RAG (page-level BM25, no embeddings) ─────────────────────────
# VECTORLESS_SYSTEM_PROMPT lives in .prompts and is imported above.


def build_prompt_vectorless(
    query: str,
    context_pages: list[dict],
    mcp_context: str = "",
) -> tuple[dict, dict]:
    """Build (system_message, user_message) for vectorless RAG (page-level)."""
    return build_context_prompt(
        query, context_pages, "Page", VECTORLESS_SYSTEM_PROMPT, mcp_context=mcp_context,
    )


def answer_query_vectorless(
    query: str,
    context_store: ContextStore,
    history: list = None,
    mcp_context: str = "",
    top_k_pages: int = 3,
    api_key: Optional[str] = None,
) -> dict:
    """
    Vectorless RAG pipeline: retrieve pages via BM25 → generate.
    Preserves page structure so visual elements (charts, tables, diagrams)
    retained in the text surrounding them are available to the LLM.
    """
    # Retrieve top pages via lexical BM25
    context_pages = context_store.search(query, top_k=top_k_pages)

    # Guard: empty or corrupted PDF
    if not context_pages:
        return {
            "answer": (
                "I couldn't find relevant context in the uploaded document for your question. "
                "Please try rephrasing, or ensure the PDF contains searchable text."
            ),
            "sources": [],
            "usage": {"prompt_tokens": 0, "completion_tokens": 0},
        }

    # Build messages
    system_msg, user_msg = build_prompt_vectorless(
        query, context_pages, mcp_context=mcp_context,
    )

    messages = [system_msg]
    if history:
        messages.extend(m for m in history[-6:] if m.get("role") != "system")
    messages.append(user_msg)

    # Generate
    client = get_groq(api_key=api_key)
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=messages,
        temperature=0.2,
        max_tokens=1024,
    )

    answer = response.choices[0].message.content
    return {
        "answer": answer,
        "sources": [
            {"id": p["id"], "text": p["text"][:200] + "..."}
            for p in context_pages[:8]  # Limit source previews
        ],
        "usage": {
            "prompt_tokens":    response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
        },
    }


# ─── Streaming variants ──────────────────────────────────────────────────────
# Each generator yields event dicts so the API layer can forward them over SSE:
#   {"type": "sources", "sources": [...]}
#   {"type": "token",   "text": "..."}
#   {"type": "usage",   "usage": {...}}

_EMPTY_USAGE = {"prompt_tokens": 0, "completion_tokens": 0}

_EMPTY_CONTEXT_MSG = (
    "I couldn't find relevant context in the uploaded document for your question. "
    "Please try rephrasing, or ensure the PDF contains searchable text."
)


def _stream_llm(messages: list, api_key: Optional[str] = None,
                temperature: float = 0.2, max_tokens: int = 1024):
    """Yield ("token", text) chunks, then a final ("usage", {...}) tuple.

    Requests token usage via `stream_options`; if the client/SDK rejects that
    option, falls back to a plain stream and reports zero usage.
    """
    client = get_groq(api_key=api_key)
    kwargs = dict(
        model=LLM_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
    )
    try:
        stream = client.chat.completions.create(stream_options={"include_usage": True}, **kwargs)
    except Exception:
        stream = client.chat.completions.create(**kwargs)

    usage = dict(_EMPTY_USAGE)
    for chunk in stream:
        chunk_usage = getattr(chunk, "usage", None)
        if chunk_usage:
            usage = {
                "prompt_tokens": chunk_usage.prompt_tokens or 0,
                "completion_tokens": chunk_usage.completion_tokens or 0,
            }
        if chunk.choices:
            content = getattr(chunk.choices[0].delta, "content", None)
            if content:
                yield ("token", content)
    yield ("usage", usage)


def _messages_with_history(system_prompt: str, history: list, user_content: str, limit: int) -> list:
    """Build [system] → [last `limit` history messages] → [user] (drops stale system msgs)."""
    messages = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(m for m in history[-limit:] if m.get("role") != "system")
    messages.append({"role": "user", "content": user_content})
    return messages


def stream_answer_query(query: str, vector_store: VectorStore, history: list = None,
                        mcp_context: str = "", api_key: Optional[str] = None):
    """Streaming vector RAG: retrieve → rerank → stream generated answer."""
    candidates = _dedupe_chunks(vector_store.search(query, top_k=15))
    top_chunks = rerank(query, candidates, top_k=5)
    top_chunks = _expand_neighbors(top_chunks, vector_store.chunks)

    if not top_chunks:
        yield {"type": "sources", "sources": []}
        yield {"type": "token", "text": _EMPTY_CONTEXT_MSG}
        yield {"type": "usage", "usage": dict(_EMPTY_USAGE)}
        return

    yield {"type": "sources", "sources": [
        {"id": c["id"], "text": c["text"][:200] + "..."} for c in top_chunks
    ]}

    system_msg, user_msg = build_prompt(query, top_chunks, mcp_context=mcp_context)
    messages = _messages_with_history(system_msg["content"], history, user_msg["content"], limit=6)
    for kind, payload in _stream_llm(messages, api_key=api_key, temperature=0.2):
        yield {"type": "token", "text": payload} if kind == "token" else {"type": "usage", "usage": payload}


def stream_answer_query_vectorless(query: str, context_store: ContextStore, history: list = None,
                                   mcp_context: str = "", top_k_pages: int = 3,
                                   api_key: Optional[str] = None):
    """Streaming vectorless RAG: BM25 page retrieval → stream generated answer."""
    context_pages = context_store.search(query, top_k=top_k_pages)

    if not context_pages:
        yield {"type": "sources", "sources": []}
        yield {"type": "token", "text": _EMPTY_CONTEXT_MSG}
        yield {"type": "usage", "usage": dict(_EMPTY_USAGE)}
        return

    yield {"type": "sources", "sources": [
        {"id": p["id"], "text": p["text"][:200] + "..."} for p in context_pages[:8]
    ]}

    system_msg, user_msg = build_prompt_vectorless(query, context_pages, mcp_context=mcp_context)
    messages = _messages_with_history(system_msg["content"], history, user_msg["content"], limit=6)
    for kind, payload in _stream_llm(messages, api_key=api_key, temperature=0.2):
        yield {"type": "token", "text": payload} if kind == "token" else {"type": "usage", "usage": payload}


def stream_mcp_answer(query: str, mcp_context: str, history: list = None,
                      api_key: Optional[str] = None):
    """Streaming synthesis from external MCP search results only (no PDF)."""
    system = (
        "You are an expert AI research assistant. "
        "Synthesize the external search results below (ArXiv, GitHub, HuggingFace) to answer the user's question. "
        "Be structured and concise, reference sources by name/authors/stars, and highlight practical implementations."
    )
    messages = _messages_with_history(system, history, f"External search results:\n{mcp_context}\n\nQuestion: {query}", limit=4)
    for kind, payload in _stream_llm(messages, api_key=api_key, temperature=0.2):
        yield {"type": "token", "text": payload} if kind == "token" else {"type": "usage", "usage": payload}


def stream_general_answer(query: str, history: list = None, api_key: Optional[str] = None):
    """Streaming answer for general academic/ML questions with no document or tools."""
    system = (
        "You are an elite academic AI research assistant and scholar. "
        "Help researchers, engineers, and students understand machine learning architectures, "
        "algorithms, training paradigms, mathematical formulas, and scientific concepts. "
        "Provide rigorous, insightful, and clearly structured answers with markdown formatting, "
        "equations, or code examples where appropriate. "
        "Note: The user can also upload specific research paper PDFs in the sidebar at any time to ground queries directly in their paper."
    )
    messages = _messages_with_history(system, history, query, limit=6)
    for kind, payload in _stream_llm(messages, api_key=api_key, temperature=0.3, max_tokens=1200):
        yield {"type": "token", "text": payload} if kind == "token" else {"type": "usage", "usage": payload}
