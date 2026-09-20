from flask import Flask, request, jsonify, g
from flask_cors import CORS
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import os
import re
import json

load_dotenv()

from rag.parser import parse_pdf
from rag.splitter import split_text
from rag.vectorstore import VectorStore
from rag.context_store import ContextStore
from rag.pipeline import (
    answer_query,
    answer_query_vectorless,
    get_groq,
    LLM_MODEL,
    FAST_MODEL,
)
from mcp.arxiv_tool import search_arxiv
from mcp.github_tool import search_github
from mcp.huggingface_tool import search_datasets, search_models
from security import (
    create_limiter, register_security_headers,
    validate_session_id, validate_query, sanitize_query, validate_pdf_file,
    validate_groq_api_key, scrub_secrets,
    touch_session, start_session_cleanup, check_session_capacity,
    session_timestamps, ALLOWED_ORIGINS,
)
from privacy import get_privacy_policy, register_privacy_headers, strip_pii
from auth import auth_bp, login_required
from db import get_db, ping_db

app = Flask(__name__)
CORS(
    app,
    origins=ALLOWED_ORIGINS,
    allow_headers=["Content-Type", "Authorization", "X-Groq-Api-Key", "X-Api-Key"],
    supports_credentials=False,
)

app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", os.urandom(32).hex())

# ─── Security, Privacy & Auth Wiring ──────────────────────────────────────────
limiter = create_limiter(app)
register_security_headers(app)
register_privacy_headers(app)
app.register_blueprint(auth_bp)

# In-memory store per session
stores: dict[str, VectorStore] = {}
context_stores: dict[str, ContextStore] = {}   # vectorless RAG
rag_modes: dict[str, str] = {}                  # "vector" or "vectorless"
chat_histories: dict[str, list] = {}

# Launch background session cleanup daemon
start_session_cleanup(stores, context_stores, rag_modes, chat_histories)

_groq_client = None


def get_request_groq_key() -> str | None:
    """Extract Groq API key from request headers if present and valid format, else fallback to env."""
    from flask import has_request_context
    if has_request_context():
        custom_key = request.headers.get("X-Groq-Api-Key") or request.headers.get("X-Api-Key")
        if custom_key and custom_key.strip():
            clean_key = custom_key.strip()
            valid, _ = validate_groq_api_key(clean_key)
            if valid:
                return clean_key
    return os.environ.get("GROQ_API_KEY")


def get_groq(api_key: str | None = None):
    """Return a Groq client, prioritizing user-provided per-request API key."""
    from groq import Groq
    key = (api_key or "").strip() or get_request_groq_key()
    if not key:
        raise ValueError("No Groq API key provided. Please configure your Groq API key in Settings.")
    return Groq(api_key=key)


def strip_code_fences(text: str) -> str:
    """Extract first valid JSON object or strip markdown code fences."""
    t = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", t)
    if match:
        t = match.group(1).strip()
    # Extract bounding braces if there is any surrounding text
    brace_start = t.find("{")
    brace_end = t.rfind("}")
    if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
        t = t[brace_start:brace_end + 1].strip()
    return t


# ─── Intent Router ────────────────────────────────────────────────────────────

# Keyword signal sets — checked before any LLM call (zero latency)
ARXIV_SIGNALS  = {"paper", "papers", "arxiv", "research", "publication", "published",
                  "cite", "citing", "survey", "surveys", "literature", "preprint",
                  "related work", "academic", "journal", "conference", "findings"}
GITHUB_SIGNALS = {"github", "code", "implementation", "implementations", "repo",
                  "repos", "repository", "repositories", "library", "libraries",
                  "codebase", "open source", "open-source", "project"}
HF_DS_SIGNALS  = {"dataset", "datasets", "training data", "benchmark", "benchmarks",
                  "corpus", "corpora", "data split", "evaluation set", "testset"}
HF_MDL_SIGNALS = {"huggingface", "hf model", "pretrained", "pre-trained",
                  "model checkpoint", "model weights", "fine-tuned model",
                  "model card", "transformer model"}
ARCH_SIGNALS   = {"architecture", "diagram", "visualize", "visualise", "draw",
                  "flowchart", "network diagram", "model architecture",
                  "pipeline diagram", "show the architecture", "show architecture",
                  "show me the model", "design diagram"}


def _clean_search_query(query: str) -> str:
    """Clean query of conversational filler and tool keywords for search APIs."""
    q = query.lower()
    # Remove common punctuation
    q = re.sub(r"[^\w\s\-]", " ", q)
    
    # Conversational phrases and keywords to remove
    to_remove = [
        "show me", "find papers on", "find paper on", "find", "search for", "search", "look for",
        "are there", "tell me about", "is there", "any", "please", "can you", "could you",
        "arxiv", "paper", "papers", "research", "publication", "published", "cite", "citing", "survey", "surveys", "literature", "preprint", "academic", "journal", "conference", "findings",
        "github", "code", "implementation", "implementations", "repo", "repos", "repository", "repositories", "library", "libraries", "codebase", "open source", "open-source", "project",
        "dataset", "datasets", "training data", "benchmark", "benchmarks", "corpus", "corpora",
        "huggingface", "hf model", "pretrained", "pre-trained", "model checkpoint", "model weights", "fine-tuned model", "model card", "transformer model",
        "of", "on", "for", "about", "with", "a", "an", "the", "in"
    ]
    
    # Sort by length descending to replace multi-word phrases first
    to_remove.sort(key=len, reverse=True)
    
    for phrase in to_remove:
        # Use boundary matching for words
        q = re.sub(r'\b' + re.escape(phrase) + r'\b', ' ', q)
        
    cleaned = " ".join(q.split())
    return cleaned if cleaned else query


def _keyword_route(query: str) -> dict | None:
    """Fast keyword-based routing. Returns None if ambiguous."""
    q = query.lower()

    # Architecture takes priority (most specific intent)
    if any(sig in q for sig in ARCH_SIGNALS):
        return {"intent": "architecture", "tools": [], "search_query": query}

    # MCP tool detection
    tools = []
    if any(sig in q for sig in ARXIV_SIGNALS):
        tools.append("arxiv")
    if any(sig in q for sig in GITHUB_SIGNALS):
        tools.append("github")
    if any(sig in q for sig in HF_DS_SIGNALS):
        tools.append("hf_datasets")
    if any(sig in q for sig in HF_MDL_SIGNALS):
        tools.append("hf_models")

    if tools:
        return {"intent": "mcp", "tools": tools, "search_query": _clean_search_query(query)}

    return None  # Ambiguous — fall through to LLM router


def _llm_router(query: str, has_doc: bool) -> dict:
    """LLM-based intent classification using llama-3.1-8b-instant (fast, cheap)."""
    try:
        client = get_groq()
        system = """\
You are a query intent classifier for an AI research assistant.
Classify the user query into the most appropriate intent.

Available intents:
- "rag": Answer from the uploaded research paper document
- "arxiv": Search academic papers on ArXiv
- "github": Search code repositories on GitHub
- "hf_datasets": Search HuggingFace datasets
- "hf_models": Search HuggingFace model hub
- "architecture": Generate a visual architecture diagram
- "clarify": Query is too vague/ambiguous to act on

Rules:
- Multiple tools can apply (e.g., ["arxiv", "github"])
- Prefer "rag" when query is about understanding content from a paper
- Use "clarify" ONLY when the query is genuinely too short/vague to classify
- "architecture" for requests to visualize systems, pipelines, or model structures

Output ONLY valid JSON (no markdown, no explanation):
{
  "intent": "rag|mcp|architecture|clarify",
  "tools": ["arxiv", "github", "hf_datasets", "hf_models"],
  "search_query": "cleaned search query for external tools",
  "clarify_question": "Short clarifying question (only if intent=clarify)"
}"""

        resp = client.chat.completions.create(
            model=FAST_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": f"Query: {query}\nDocument loaded: {has_doc}"},
            ],
            temperature=0,
            max_tokens=120,
        )
        raw = strip_code_fences(resp.choices[0].message.content)
        result = json.loads(raw)

        intent = result.get("intent", "rag")
        tools  = result.get("tools", [])

        # Normalise: if intent is a tool name, convert to "mcp"
        if intent in ("arxiv", "github", "hf_datasets", "hf_models"):
            tools = [intent] + [t for t in tools if t != intent]
            intent = "mcp"

        return {
            "intent": intent,
            "tools": tools,
            "search_query": _clean_search_query(result.get("search_query", query)),
            "clarify_question": result.get("clarify_question", "What would you like to know?"),
        }
    except Exception:
        # Safe fallback
        return {
            "intent": "rag" if has_doc else "clarify",
            "tools": [],
            "search_query": query,
            "clarify_question": "What are you looking for? I can answer questions about the paper, search for related research, find code implementations, or generate architecture diagrams.",
        }


def intent_router(query: str, has_doc: bool) -> dict:
    """Route a query to the right action. Fast keyword check first, LLM fallback."""
    route = _keyword_route(query)
    if route:
        # Upgrade mcp to hybrid when doc is loaded
        if route["intent"] == "mcp" and has_doc:
            route["intent"] = "hybrid"
        return route

    # LLM router for ambiguous queries
    result = _llm_router(query, has_doc)
    if result["intent"] == "mcp" and has_doc:
        result["intent"] = "hybrid"
    return result


# ─── MCP Tool Dispatcher ──────────────────────────────────────────────────────

TOOL_LABELS = {
    "arxiv":       "ArXiv Papers",
    "github":      "GitHub Repos",
    "hf_datasets": "HuggingFace Datasets",
    "hf_models":   "HuggingFace Models",
}


def _run_mcp_tools(tools: list[str], query: str) -> tuple[list[dict], str]:
    """Run MCP tools concurrently. Returns (tool_calls_list, mcp_context_text)."""

    def _call(tool_name: str) -> dict:
        try:
            if tool_name == "arxiv":
                return {"tool": "arxiv", "results": search_arxiv(query, max_results=4)}
            elif tool_name == "github":
                return {"tool": "github", "results": search_github(query, max_results=4)}
            elif tool_name == "hf_datasets":
                return {"tool": "hf_datasets", "results": search_datasets(query, max_results=4)}
            elif tool_name == "hf_models":
                return {"tool": "hf_models", "results": search_models(query, max_results=4)}
            return {"tool": tool_name, "results": []}
        except Exception as e:
            return {"tool": tool_name, "results": [], "error": str(e)}

    tool_calls: list[dict] = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(_call, t): t for t in tools}
        for future in as_completed(futures):
            tool_calls.append(future.result())

    # Build readable context block for the LLM
    parts = []
    for tc in tool_calls:
        tool = tc["tool"]
        results = tc.get("results", [])
        if not results:
            continue
        block = f"=== {TOOL_LABELS.get(tool, tool).upper()} ===\n"
        for i, r in enumerate(results, 1):
            if tool == "arxiv":
                block += f"{i}. {r.get('title','?')} ({r.get('year','?')})\n"
                block += f"   Authors: {', '.join(r.get('authors', []))}\n"
                block += f"   URL: {r.get('url','')}\n"
                summary = r.get("summary", "")
                if summary:
                    block += f"   Abstract: {summary[:250]}...\n"
            elif tool == "github":
                block += f"{i}. {r.get('name','?')} [⭐{r.get('stars',0)} | {r.get('language','?')}]\n"
                block += f"   URL: {r.get('url','')}\n"
                desc = r.get("description", "")
                if desc:
                    block += f"   {desc[:180]}\n"
            else:  # hf_datasets / hf_models
                block += f"{i}. {r.get('id','?')} (↓{r.get('downloads', 0):,} downloads)\n"
                block += f"   URL: {r.get('url','')}\n"
                tags = r.get("tags", [])
                if tags:
                    block += f"   Tags: {', '.join(tags[:5])}\n"
        parts.append(block)

    return tool_calls, "\n\n".join(parts)


# ─── Architecture System Prompt (shared) ─────────────────────────────────────

ARCH_SYSTEM_PROMPT = """\
You are an expert software architecture diagrammer specializing in AI/ML research paper analysis.
Your task is to extract and represent the system architecture as a precise, structured JSON diagram.

## Output Contract
You MUST output ONLY a single valid JSON object. No markdown, no prose, no code fences.
The JSON must conform exactly to this schema:
{
  "title": "Short descriptive name of the architecture (3-6 words)",
  "nodes": [
    {
      "id": "1",
      "label": "Component Name",
      "type": "input|process|output|model|data|attention",
      "description": "One sentence: what this component does"
    }
  ],
  "edges": [
    {
      "source": "1",
      "target": "2",
      "label": "data flow or operation name (optional, keep short)"
    }
  ]
}

## Node Type Rules
- input     : Raw inputs entering the system (text, image, tokens, embeddings)
- data      : Datasets, databases, knowledge bases, corpora
- process   : Transformations, encoders, decoders, layers, attention, FFN blocks
- model     : Complete sub-models, pre-trained backbones, LLMs, fine-tuned modules
- attention : Attention mechanisms, cross-attention, self-attention, memory modules
- output    : Final outputs, predictions, generated sequences, scores

## Quality Rules
1. Use 6-14 nodes total — enough to be informative, not cluttered.
2. IDs must be unique integers as strings: "1", "2", "3", ...
3. Node labels must be concise (1-4 words), using the paper's own terminology.
4. Edges must only reference valid node IDs that exist in the nodes array.
5. Descriptions should explain *function*, not just restate the label.
6. Represent actual data flow direction (left to right or top to bottom).
7. If context is insufficient, generate a plausible general architecture for the described system."""


def _generate_architecture_internal(prompt: str, store) -> dict:
    """Generate architecture JSON, optionally grounded in uploaded paper."""
    context = ""
    if store and store.is_ready():
        arch_query = prompt or "architecture methodology system design pipeline"
        # ContextStore has search_for_architecture; VectorStore has search(top_k=)
        if hasattr(store, "search_for_architecture"):
            candidates = store.search_for_architecture(arch_query, top_k=5)
        else:
            candidates = store.search(arch_query, top_k=5)
        context = "\n\n".join(c["text"] for c in candidates)

    client = get_groq()
    resp = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": ARCH_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Paper context:\n{context}\n\n"
                    f"Generate the architecture diagram JSON for: {prompt or 'this research paper'}\n\n"
                    "Output ONLY the JSON object. No explanations."
                ),
            },
        ],
        temperature=0.1,
        max_tokens=1024,
    )
    raw = resp.choices[0].message.content
    clean = strip_code_fences(raw)
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        return {"title": prompt or "Architecture", "nodes": [], "edges": [], "error": "Parse failed"}


def _synthesize_mcp_only(query: str, mcp_context: str, history: list) -> tuple[str, dict]:
    """Synthesize an answer from MCP results only (no PDF loaded)."""
    client = get_groq()
    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful research assistant. "
                "Synthesize the external search results below to answer the user's question. "
                "Be concise, reference sources by name, and highlight the most relevant findings."
            ),
        },
        *[m for m in (history or [])[-4:] if m.get("role") != "system"],
        {
            "role": "user",
            "content": f"External search results:\n{mcp_context}\n\nQuestion: {query}",
        },
    ]
    resp = client.chat.completions.create(
        model=LLM_MODEL,
        messages=messages,
        temperature=0.2,
        max_tokens=768,
    )
    return resp.choices[0].message.content, {
        "prompt_tokens": resp.usage.prompt_tokens,
        "completion_tokens": resp.usage.completion_tokens,
    }


# ─── RAG Endpoints ────────────────────────────────────────────────────────────

@app.route("/api/upload", methods=["POST"])
@limiter.limit("5 per minute")
@login_required
def upload_pdf():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    session_id = request.form.get("session_id", "default")

    # ── Security: validate session ID format ──
    if not validate_session_id(session_id):
        return jsonify({"error": "Invalid session ID format"}), 400

    # ── Security: check session capacity ──
    if session_id not in session_timestamps and not check_session_capacity():
        return jsonify({"error": "Server is at capacity. Please try again later."}), 503

    # ── Security: validate file type (extension + magic bytes) ──
    valid, err = validate_pdf_file(file)
    if not valid:
        return jsonify({"error": err}), 400

    parsed = parse_pdf(file.read())
    touch_session(session_id)

    # Auto-select RAG mode based on visual content detection
    if parsed.get("has_visuals", False):
        # Vectorless RAG — preserve page structure for visual PDFs
        cs = ContextStore()
        cs.build(parsed["pages"], parsed["text"])
        context_stores[session_id] = cs
        stores.pop(session_id, None)         # clear any old vector store
        rag_modes[session_id] = "vectorless"
        num_chunks = len(parsed["pages"])
    else:
        # Vector RAG — standard chunking + FAISS for text-only PDFs
        chunks = split_text(parsed["text"], chunk_size=512, chunk_overlap=64)
        vs = VectorStore()
        vs.build(chunks)
        stores[session_id] = vs
        context_stores.pop(session_id, None)  # clear any old context store
        rag_modes[session_id] = "vector"
        num_chunks = len(chunks)

    chat_histories[session_id] = []
    _ensure_session(g.user_id, session_id, doc_name=getattr(file, "filename", "document.pdf"), rag_mode=rag_modes[session_id])

    return jsonify({
        "message": "PDF indexed successfully",
        "num_pages": parsed["num_pages"],
        "num_chunks": num_chunks,
        "session_id": session_id,
        "rag_mode": rag_modes[session_id],
        "has_visuals": parsed.get("has_visuals", False),
        "visual_stats": parsed.get("visual_stats", {}),
    })


# ─── Chat Persistence Helpers ─────────────────────────────────────────────────

def _persist_chat_message(user_id, session_id, role, content, intent=None, sources=None, arch_data=None):
    """Save a chat message to MongoDB (fire-and-forget, never blocks the response)."""
    try:
        db = get_db()
        db.chat_messages.insert_one({
            "user_id": str(user_id),
            "session_id": session_id,
            "role": role,
            "content": content,
            "intent": intent,
            "sources": sources,
            "arch_data": arch_data,
            "timestamp": datetime.now(timezone.utc),
        })
    except Exception:
        pass  # Don't let DB errors break the chat flow


def _ensure_session(user_id, session_id, doc_name=None, rag_mode=None):
    """Create or update a session record in MongoDB."""
    try:
        db = get_db()
        db.sessions.update_one(
            {"user_id": str(user_id), "session_id": session_id},
            {"$set": {
                "last_active": datetime.now(timezone.utc),
                **({"doc_name": doc_name} if doc_name else {}),
                **({"rag_mode": rag_mode} if rag_mode else {}),
            },
            "$setOnInsert": {
                "created_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )
    except Exception:
        pass


@app.route("/api/chat", methods=["POST"])
@limiter.limit("20 per minute")
@login_required
def chat():
    """Agentic chat: auto-route to RAG / MCP tools / architecture / clarify."""
    data = request.json or {}
    query = data.get("query", "").strip()
    session_id = data.get("session_id", "default")

    # ── Security: validate session ID ──
    if not validate_session_id(session_id):
        return jsonify({"error": "Invalid session ID format"}), 400

    # ── Security: validate & sanitize query ──
    valid, err = validate_query(query)
    if not valid:
        return jsonify({"error": err}), 400
    query = sanitize_query(query)

    # ── Privacy: strip PII before it reaches the LLM ──
    query = strip_pii(query)

    touch_session(session_id)

    vs = stores.get(session_id)
    cs = context_stores.get(session_id)
    mode = rag_modes.get(session_id, "vector")
    has_doc = (vs is not None and vs.is_ready()) or (cs is not None and cs.is_ready())
    history = chat_histories.get(session_id, [])

    _ensure_session(g.user_id, session_id, rag_mode=mode if has_doc else None)

    # ── Step 1: Route ──────────────────────────────────────────────────────
    route = intent_router(query, has_doc)
    intent = route["intent"]

    # ── Step 2a: Clarify ───────────────────────────────────────────────────
    if intent == "clarify":
        clarify_msg = route.get(
            "clarify_question",
            "What would you like to do? I can answer questions about the paper, "
            "search for related research, find code implementations, or draw architecture diagrams.",
        )
        _persist_chat_message(g.user_id, session_id, "user", query, intent="clarify")
        _persist_chat_message(g.user_id, session_id, "assistant", clarify_msg, intent="clarify")
        return jsonify({
            "intent": "clarify",
            "clarify_question": clarify_msg,
            "answer": None,
            "sources": [],
            "tool_calls": [],
            "arch_data": None,
            "rag_mode": mode if has_doc else None,
            "usage": {"prompt_tokens": 0, "completion_tokens": 0},
        })

    # ── Step 2b: Architecture ──────────────────────────────────────────────
    if intent == "architecture":
        arch_store = vs or cs  # use whichever store is available
        arch_data = _generate_architecture_internal(query, arch_store)
        arch_title = arch_data.get("title", "Architecture Diagram")
        n_nodes = len(arch_data.get("nodes", []))
        answer = (
            f"I've generated the **{arch_title}** diagram with {n_nodes} components. "
            "Expand the diagram below to explore it interactively."
        )
        _persist_chat_message(g.user_id, session_id, "user", query, intent="architecture")
        _persist_chat_message(g.user_id, session_id, "assistant", answer, intent="architecture", arch_data=arch_data)
        return jsonify({
            "intent": "architecture",
            "answer": answer,
            "arch_data": arch_data,
            "sources": [],
            "tool_calls": [],
            "rag_mode": mode if has_doc else None,
            "usage": {"prompt_tokens": 0, "completion_tokens": 0},
        })

    # ── Step 2c: MCP tool calls (concurrent) ──────────────────────────────
    tool_calls: list[dict] = []
    mcp_context = ""
    if route.get("tools"):
        tool_calls, mcp_context = _run_mcp_tools(route["tools"], route.get("search_query", query))

    # ── Step 3 & 4: RAG (always run if doc loaded) ─────────────────────────
    if has_doc:
        req_key = get_request_groq_key()
        if mode == "vectorless" and cs is not None:
            # Vectorless RAG — page-level BM25
            result = answer_query_vectorless(query, cs, history, mcp_context=mcp_context, api_key=req_key)
        else:
            # Vector RAG — chunk-level FAISS + reranking
            result = answer_query(query, vs, history, mcp_context=mcp_context, api_key=req_key)

        history.append({"role": "user", "content": query})
        history.append({"role": "assistant", "content": result["answer"]})
        chat_histories[session_id] = history
        _persist_chat_message(g.user_id, session_id, "user", query, intent=intent)
        _persist_chat_message(g.user_id, session_id, "assistant", result["answer"], intent=intent, sources=result["sources"])
        return jsonify({
            "intent": intent,
            "answer": result["answer"],
            "sources": result["sources"],
            "tool_calls": tool_calls,
            "arch_data": None,
            "rag_mode": mode,
            "usage": result["usage"],
        })

    # ── No doc loaded — synthesise from MCP only ───────────────────────────
    if mcp_context:
        answer, usage = _synthesize_mcp_only(query, mcp_context, history)
        history.append({"role": "user", "content": query})
        history.append({"role": "assistant", "content": answer})
        chat_histories[session_id] = history
        _persist_chat_message(g.user_id, session_id, "user", query, intent=intent)
        _persist_chat_message(g.user_id, session_id, "assistant", answer, intent=intent)
        return jsonify({
            "intent": intent,
            "answer": answer,
            "sources": [],
            "tool_calls": tool_calls,
            "arch_data": None,
            "rag_mode": None,
            "usage": usage,
        })

    # ── Fallback: no doc, no MCP — ask to upload ──────────────────────────
    clarify_msg = "Please upload a PDF research paper first, or try asking me to search for papers, code, or datasets."
    _persist_chat_message(g.user_id, session_id, "user", query, intent="clarify")
    _persist_chat_message(g.user_id, session_id, "assistant", clarify_msg, intent="clarify")
    return jsonify({
        "intent": "clarify",
        "clarify_question": clarify_msg,
        "answer": None,
        "sources": [],
        "tool_calls": [],
        "arch_data": None,
        "rag_mode": None,
        "usage": {"prompt_tokens": 0, "completion_tokens": 0},
    })


@app.route("/api/history/<session_id>", methods=["GET"])
@login_required
def get_history(session_id):
    """Return chat history — from MongoDB if available, else in-memory."""
    try:
        db = get_db()
        messages = list(db.chat_messages.find(
            {"user_id": g.user_id, "session_id": session_id},
            {"_id": 0, "user_id": 0},
        ).sort("timestamp", 1))
        # Convert datetimes to ISO strings for JSON
        for m in messages:
            if "timestamp" in m and hasattr(m["timestamp"], "isoformat"):
                m["timestamp"] = m["timestamp"].isoformat()
        return jsonify(messages if messages else chat_histories.get(session_id, []))
    except Exception:
        return jsonify(chat_histories.get(session_id, []))


@app.route("/api/sessions", methods=["GET"])
@login_required
def get_sessions():
    """List all sessions for the authenticated user."""
    try:
        db = get_db()
        sessions = list(db.sessions.find(
            {"user_id": g.user_id},
            {"_id": 0},
        ).sort("last_active", -1).limit(20))
        for s in sessions:
            for key in ("created_at", "last_active"):
                if key in s and hasattr(s[key], "isoformat"):
                    s[key] = s[key].isoformat()
        return jsonify(sessions)
    except Exception:
        return jsonify([])


@app.route("/api/clear/<session_id>", methods=["DELETE"])
@login_required
def clear_session(session_id):
    stores.pop(session_id, None)
    context_stores.pop(session_id, None)
    rag_modes.pop(session_id, None)
    chat_histories.pop(session_id, None)
    session_timestamps.pop(session_id, None)
    # Also clear from MongoDB
    try:
        db = get_db()
        db.chat_messages.delete_many({"user_id": g.user_id, "session_id": session_id})
        db.sessions.delete_one({"user_id": g.user_id, "session_id": session_id})
    except Exception:
        pass
    return jsonify({"message": "Session cleared"})


# ─── MCP Tool Endpoints (kept for direct access / debugging) ──────────────────

@app.route("/api/mcp/arxiv", methods=["GET"])
@limiter.limit("30 per minute")
def arxiv():
    query = request.args.get("q", "")
    if not query:
        return jsonify({"error": "Missing query param 'q'"}), 400
    try:
        return jsonify({"results": search_arxiv(query, max_results=int(request.args.get("n", 5)))})
    except Exception as e:
        return jsonify({"error": f"ArXiv search failed: {str(e)}"}), 502


@app.route("/api/mcp/github", methods=["GET"])
@limiter.limit("30 per minute")
def github():
    query = request.args.get("q", "")
    if not query:
        return jsonify({"error": "Missing query param 'q'"}), 400
    try:
        return jsonify({"results": search_github(query, max_results=int(request.args.get("n", 5)))})
    except Exception as e:
        return jsonify({"error": f"GitHub search failed: {str(e)}"}), 502


@app.route("/api/mcp/huggingface/datasets", methods=["GET"])
@limiter.limit("30 per minute")
def hf_datasets():
    query = request.args.get("q", "")
    try:
        return jsonify({"results": search_datasets(query, max_results=int(request.args.get("n", 5)))})
    except Exception as e:
        return jsonify({"error": f"HuggingFace datasets search failed: {str(e)}"}), 502


@app.route("/api/mcp/huggingface/models", methods=["GET"])
@limiter.limit("30 per minute")
def hf_models():
    query = request.args.get("q", "")
    try:
        return jsonify({"results": search_models(query, max_results=int(request.args.get("n", 5)))})
    except Exception as e:
        return jsonify({"error": f"HuggingFace models search failed: {str(e)}"}), 502


# ─── Architecture (standalone endpoint kept for compatibility) ─────────────────

@app.route("/api/architecture", methods=["POST"])
@login_required
def generate_architecture():
    data = request.json
    prompt = data.get("prompt", "")
    session_id = data.get("session_id", "default")
    store = stores.get(session_id) or context_stores.get(session_id)
    try:
        arch = _generate_architecture_internal(prompt, store)
        return jsonify(arch)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/prototype", methods=["POST"])
@login_required
def generate_prototype_endpoint():
    data = request.json or {}
    description = data.get("description", "").strip()
    try:
        groq = get_groq()
        resp = groq.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert React UI engineer. Given a description of a machine learning or technical concept, "
                        "generate a clean, fully working, self-contained React functional component named `Component`. "
                        "Use modern inline styles or standard CSS variables. Use only standard React hooks (useState, useEffect, useMemo, etc.). "
                        "Output ONLY executable JavaScript/JSX code."
                    ),
                },
                {"role": "user", "content": description},
            ],
            temperature=0.2,
        )
        code = resp.choices[0].message.content
        return jsonify({"code": code})
    except Exception as e:
        return jsonify({"error": f"Prototype generation failed: {str(e)}"}), 500


# ─── Privacy Endpoint ─────────────────────────────────────────────────────────

@app.route("/api/privacy", methods=["GET"])
def privacy_policy():
    """Return the application's data privacy policy as JSON."""
    return jsonify(get_privacy_policy())


# ─── Error handlers ───────────────────────────────────────────────────────────

@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": "File too large. Maximum size is 20 MB."}), 413


@app.errorhandler(500)
def internal_error(e):
    # Never leak stack traces in production
    return jsonify({"error": "Internal server error"}), 500


def _extract_groq_telemetry(headers: dict) -> dict:
    """Safely parse Groq rate limit and quota headers from response."""
    def _to_int(val, default=0):
        try:
            return int(val)
        except (TypeError, ValueError):
            return default

    limit_reqs = _to_int(headers.get("x-ratelimit-limit-requests"))
    rem_reqs = _to_int(headers.get("x-ratelimit-remaining-requests"))
    limit_tokens = _to_int(headers.get("x-ratelimit-limit-tokens"))
    rem_tokens = _to_int(headers.get("x-ratelimit-remaining-tokens"))
    reset_reqs = headers.get("x-ratelimit-reset-requests", "0s")
    reset_tokens = headers.get("x-ratelimit-reset-tokens", "0s")

    reqs_pct = round((rem_reqs / limit_reqs * 100), 1) if limit_reqs > 0 else 100.0
    tokens_pct = round((rem_tokens / limit_tokens * 100), 1) if limit_tokens > 0 else 100.0

    return {
        "limit_requests": limit_reqs,
        "remaining_requests": rem_reqs,
        "requests_pct": reqs_pct,
        "reset_requests": reset_reqs,
        "limit_tokens": limit_tokens,
        "remaining_tokens": rem_tokens,
        "tokens_pct": tokens_pct,
        "reset_tokens": reset_tokens,
    }


@app.route("/api/test-key", methods=["POST"])
@app.route("/api/key-usage", methods=["GET", "POST"])
@limiter.limit("30 per minute")
def test_key():
    """Verify user's provided Groq API key and fetch real-time quota & rate-limit telemetry."""
    api_key = (
        request.headers.get("X-Groq-Api-Key")
        or request.headers.get("X-Api-Key")
        or (request.json.get("api_key") if request.is_json else None)
    )
    if not api_key:
        return jsonify({"error": "No API key provided in X-Groq-Api-Key header"}), 400

    clean_key = api_key.strip()
    valid, err = validate_groq_api_key(clean_key)
    if not valid:
        return jsonify({"valid": False, "error": err}), 400

    try:
        from groq import Groq
        client = Groq(api_key=clean_key)
        raw_resp = client.chat.completions.with_raw_response.create(
            model=FAST_MODEL,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
        )
        telemetry = _extract_groq_telemetry(dict(raw_resp.headers))

        return jsonify({
            "valid": True,
            "model": FAST_MODEL,
            "status": "connected",
            "usage": telemetry,
        })
    except Exception as e:
        safe_err = scrub_secrets(str(e))
        return jsonify({"valid": False, "error": safe_err}), 400


@app.route("/health")
def health():
    db_ok = ping_db()
    return jsonify({"status": "ok", "database": "connected" if db_ok else "disconnected"})


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "true").lower() in ("true", "1")
    app.run(debug=debug, port=5000, use_reloader=False)
