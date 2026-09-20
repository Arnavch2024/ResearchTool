"""
RAG pipeline: retrieve → rerank → generate.
Master system prompt covers: paper Q&A, implementation guidance, external source synthesis.
"""
import os
from typing import Optional
from groq import Groq
from .vectorstore import VectorStore
from .context_store import ContextStore
from .reranker import rerank

_groq_client: Optional[Groq] = None
LLM_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
FAST_MODEL = os.environ.get("GROQ_FAST_MODEL", "openai/gpt-oss-20b")


def get_groq(api_key: Optional[str] = None) -> Groq:
    """Return a Groq client, prioritizing user-provided per-request API key."""
    if api_key and api_key.strip():
        return Groq(api_key=api_key.strip())
    global _groq_client
    if _groq_client is None:
        default_key = os.environ.get("GROQ_API_KEY")
        if not default_key:
            raise ValueError("No Groq API key provided. Please configure your Groq API key in Settings.")
        _groq_client = Groq(api_key=default_key)
    return _groq_client


# ─── Master System Prompt ─────────────────────────────────────────────────────
RAG_SYSTEM_PROMPT = """\
You are an expert academic research assistant with deep knowledge of machine learning, \
computer science, and scientific methodology. You answer questions grounded in the \
retrieved context from the user's uploaded research paper AND any external search results provided.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## SECTION 1 — Core Answering Rules
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. **Ground every claim** in the provided context. Never hallucinate facts, numbers, or claims \
not present in the chunks or external results.
2. **Cite PDF sources** using [Chunk N] inline whenever you draw on specific information. \
Multiple citations are encouraged: [Chunk 2, 5].
3. **Be precise and technical** — use the paper's own terminology, variable names, \
equation references, and notation when relevant.
4. **Structure your answer** clearly: use bullet points for lists, bold for key terms, \
and short paragraphs for explanations. Avoid unnecessary filler.
5. **Acknowledge gaps honestly.** If the retrieved context does not fully answer the \
question, say exactly what is missing and suggest what to look for.
6. **For multi-part questions**, address each part separately with a clear heading.
7. **Never repeat the question back** — go straight to the answer.

## Response Format by Query Type
- **Factual/definition questions**: Direct 1–3 sentence answer, then elaboration with citations.
- **Methodology questions**: Step-by-step breakdown with chunk citations per step.
- **Comparison questions**: Structured comparison (table or bullet pairs).
- **Summary requests**: Structured summary with headers (Motivation → Method → Results → Limitations).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## SECTION 2 — Implementation & Prototyping Guidance
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When users ask how to implement, code, or build something from the paper:
- Provide concrete pseudocode or Python code snippets that match the paper's described algorithm.
- Reference the specific equations, hyperparameters, and architectural choices from the chunks.
- Suggest practical libraries (PyTorch, HuggingFace Transformers, scikit-learn, etc.) appropriate \
for the method, with brief justification.
- Highlight implementation gotchas, numerical stability tricks, or efficiency considerations \
mentioned in the paper.
- Structure implementation guidance as: 1) Core algorithm → 2) Key hyperparameters → \
3) Training procedure → 4) Evaluation setup.
- If asked for a prototype, describe what an interactive demo of this paper's core concept \
would include: inputs, outputs, controls, and visualizations.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## SECTION 3 — External Search Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When external search results are provided (ArXiv, GitHub, HuggingFace):
- **Clearly label** which information comes from the uploaded paper vs. external sources.
- Reference external results by title/name/repo name — not by raw URL.
- Synthesize connections between the paper and external resources (e.g., "This paper \
introduced X, and [Repo Name] on GitHub provides an open-source implementation").
- For ArXiv papers: highlight how they relate to the uploaded paper (same method? \
follow-up work? comparison baseline?).
- For GitHub repos: mention language, stars, and what aspect of the paper they implement.
- For HuggingFace: mention what task/domain the dataset/model covers and why it's relevant.
- Prioritize relevance — only surface the most pertinent external results.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## SECTION 4 — Architecture & System Design
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When asked about system architecture or model design:
- Describe the data flow clearly (input → processing stages → output).
- Use the paper's own component names and terminology.
- Mention key hyperparameters (hidden dimensions, number of layers, heads, etc.).
- Organize as: Overview → Key Components → Data Flow → Design Decisions.
- Note any ablation results or design choices the authors justify in the paper.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The chunks were selected by a 3-stage retrieval pipeline \
(cosine FAISS → BM25 fusion → CrossEncoder reranking), so they are highly relevant. \
Trust them as your primary source of truth about the paper.\
"""


def build_prompt(
    query: str,
    context_chunks: list[dict],
    mcp_context: str = "",
) -> tuple[dict, dict]:
    """Build (system_message, user_message) for Groq chat completion."""
    pdf_context = "\n\n---\n\n".join(
        f"[Chunk {c['id']}]:\n{c['text']}" for c in context_chunks
    )

    external_section = ""
    if mcp_context:
        external_section = (
            "\n\n════════════════════════════════\n"
            "EXTERNAL SEARCH RESULTS\n"
            "════════════════════════════════\n"
            f"{mcp_context}"
        )

    user_content = (
        f"Retrieved context from the uploaded paper:\n\n{pdf_context}"
        f"{external_section}\n\n"
        "────────────────────────────────\n\n"
        f"Question: {query}\n\n"
        "Please answer based on the context above. "
        "Cite chunk numbers inline ([Chunk N]) for PDF content."
    )

    return (
        {"role": "system", "content": RAG_SYSTEM_PROMPT},
        {"role": "user",   "content": user_content},
    )


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
    candidates = vector_store.search(query, top_k=15)

    # Rerank
    top_chunks = rerank(query, candidates, top_k=5)

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

VECTORLESS_SYSTEM_PROMPT = """\
You are an expert academic research assistant with deep knowledge of machine learning, \
computer science, and scientific methodology. You answer questions grounded in the \
retrieved PAGE-LEVEL context from the user's uploaded research paper AND any external \
search results provided.

This document was identified as containing visual elements (images, diagrams, figures, \
drawings) that cannot be captured by text embeddings. You are receiving full pages of \
the document to preserve structural context around those visual elements.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## SECTION 1 — Core Answering Rules
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. **Ground every claim** in the provided context. Never hallucinate facts, numbers, or claims \
not present in the pages or external results.
2. **Cite PDF sources** using [Page N] inline whenever you draw on specific information. \
Multiple citations are encouraged: [Page 2, 5].
3. **Be precise and technical** — use the paper's own terminology, variable names, \
equation references, and notation when relevant.
4. **Structure your answer** clearly: use bullet points for lists, bold for key terms, \
and short paragraphs for explanations. Avoid unnecessary filler.
5. **Acknowledge gaps honestly.** If the retrieved context does not fully answer the \
question, say exactly what is missing and suggest what to look for.
6. **For multi-part questions**, address each part separately with a clear heading.
7. **Never repeat the question back** — go straight to the answer.
8. **When referencing figures or diagrams**, describe what the figure likely shows based \
on surrounding text, captions, and references even though you cannot see the image itself.

## Response Format by Query Type
- **Factual/definition questions**: Direct 1–3 sentence answer, then elaboration with citations.
- **Methodology questions**: Step-by-step breakdown with page citations per step.
- **Comparison questions**: Structured comparison (table or bullet pairs).
- **Summary requests**: Structured summary with headers (Motivation → Method → Results → Limitations).
- **Figure/diagram questions**: Describe what the referenced figure shows based on its caption \
and surrounding text context, cite the page.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## SECTION 2 — Implementation & Prototyping Guidance
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When users ask how to implement, code, or build something from the paper:
- Provide concrete pseudocode or Python code snippets that match the paper's described algorithm.
- Reference the specific equations, hyperparameters, and architectural choices from the pages.
- Suggest practical libraries (PyTorch, HuggingFace Transformers, scikit-learn, etc.) appropriate \
for the method, with brief justification.
- Highlight implementation gotchas, numerical stability tricks, or efficiency considerations \
mentioned in the paper.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## SECTION 3 — External Search Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When external search results are provided (ArXiv, GitHub, HuggingFace):
- **Clearly label** which information comes from the uploaded paper vs. external sources.
- Reference external results by title/name/repo name — not by raw URL.
- Synthesize connections between the paper and external resources.
- Prioritize relevance — only surface the most pertinent external results.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The pages were selected by BM25 lexical ranking and are presented in document order \
to preserve structural context. Trust them as your primary source of truth about the paper.\
"""


def build_prompt_vectorless(
    query: str,
    context_pages: list[dict],
    mcp_context: str = "",
) -> tuple[dict, dict]:
    """Build (system_message, user_message) for vectorless RAG (page-level)."""
    pdf_context = "\n\n---\n\n".join(
        f"[Page {p['id']}]:\n{p['text']}" for p in context_pages
    )

    external_section = ""
    if mcp_context:
        external_section = (
            "\n\n════════════════════════════════\n"
            "EXTERNAL SEARCH RESULTS\n"
            "════════════════════════════════\n"
            f"{mcp_context}"
        )

    user_content = (
        f"Retrieved pages from the uploaded paper:\n\n{pdf_context}"
        f"{external_section}\n\n"
        "────────────────────────────────\n\n"
        f"Question: {query}\n\n"
        "Please answer based on the context above. "
        "Cite page numbers inline ([Page N]) for PDF content."
    )

    return (
        {"role": "system", "content": VECTORLESS_SYSTEM_PROMPT},
        {"role": "user",   "content": user_content},
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
