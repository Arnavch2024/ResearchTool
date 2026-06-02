from groq import Groq
from .vectorstore import VectorStore
from .reranker import rerank
import os

_groq_client = None

def get_groq():
    global _groq_client
    if _groq_client is None:
        _groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])
    return _groq_client


def build_prompt(query: str, context_chunks: list[dict]) -> tuple[dict, dict]:
    """Returns (system_message, user_message) as separate dicts."""
    context = "\n\n---\n\n".join(
        f"[Chunk {c['id']}]:\n{c['text']}" for c in context_chunks
    )
    system_msg = {
        "role": "system",
        "content": (
            "You are an expert research assistant. Answer questions strictly based on "
            "the provided context from research papers. Be precise, cite chunk numbers "
            "when referencing specific information, and acknowledge if something is "
            "not covered in the context."
        )
    }
    user_msg = {
        "role": "user",
        "content": f"Context:\n{context}\n\nQuestion: {query}"
    }
    return system_msg, user_msg


def answer_query(query: str, vector_store: VectorStore, history: list = None) -> dict:
    """
    Full RAG pipeline: retrieve → rerank → generate.
    Message order: [system] → [history (last 3 turns)] → [user+context]
    """
    # Retrieve
    candidates = vector_store.search(query, top_k=15)

    # Rerank
    top_chunks = rerank(query, candidates, top_k=5)

    # Build messages: system prompt MUST come first for LLaMA / Groq
    system_msg, user_msg = build_prompt(query, top_chunks)

    messages = [system_msg]
    if history:
        # Keep last 3 turns (6 messages); filter out any stale system messages
        messages.extend(m for m in history[-6:] if m.get("role") != "system")
    messages.append(user_msg)

    # Generate with Groq llama-3.3-70b-versatile
    client = get_groq()
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.2,
        max_tokens=1024,
    )

    answer = response.choices[0].message.content
    return {
        "answer": answer,
        "sources": [{"id": c["id"], "text": c["text"][:200] + "..."} for c in top_chunks],
        "usage": {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
        }
    }
