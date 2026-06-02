from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import json

load_dotenv()

from rag.parser import parse_pdf
from rag.splitter import split_text
from rag.vectorstore import VectorStore
from rag.pipeline import answer_query
from mcp.arxiv_tool import search_arxiv
from mcp.github_tool import search_github
from mcp.huggingface_tool import search_datasets, search_models

app = Flask(__name__)
CORS(app)

# Limit upload size to 20 MB to prevent OOM on large PDFs
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024

# In-memory store per session (keyed by session_id)
stores: dict[str, VectorStore] = {}
chat_histories: dict[str, list] = {}

# Shared lazy Groq client (avoids recreating it on every request)
_groq_client = None

def get_groq():
    global _groq_client
    if _groq_client is None:
        from groq import Groq
        _groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])
    return _groq_client


# ─── RAG Endpoints ────────────────────────────────────────────────────────────

@app.route("/api/upload", methods=["POST"])
def upload_pdf():
    """Parse PDF, chunk it, build vector index."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    session_id = request.form.get("session_id", "default")

    parsed = parse_pdf(file.read())
    chunks = split_text(parsed["text"], chunk_size=512, chunk_overlap=64)

    vs = VectorStore()
    vs.build(chunks)
    stores[session_id] = vs
    chat_histories[session_id] = []

    return jsonify({
        "message": "PDF indexed successfully",
        "num_pages": parsed["num_pages"],
        "num_chunks": len(chunks),
        "session_id": session_id,
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    """RAG Q&A over uploaded paper."""
    data = request.json
    query = data.get("query", "").strip()
    session_id = data.get("session_id", "default")

    if not query:
        return jsonify({"error": "Empty query"}), 400

    vs = stores.get(session_id)
    if not vs or not vs.is_ready():
        return jsonify({"error": "No document indexed for this session"}), 400

    history = chat_histories.get(session_id, [])
    result = answer_query(query, vs, history)

    # Update history
    history.append({"role": "user", "content": query})
    history.append({"role": "assistant", "content": result["answer"]})
    chat_histories[session_id] = history

    return jsonify(result)


@app.route("/api/history/<session_id>", methods=["GET"])
def get_history(session_id):
    return jsonify(chat_histories.get(session_id, []))


@app.route("/api/clear/<session_id>", methods=["DELETE"])
def clear_session(session_id):
    stores.pop(session_id, None)
    chat_histories.pop(session_id, None)
    return jsonify({"message": "Session cleared"})


# ─── MCP Tool Endpoints ────────────────────────────────────────────────────────

@app.route("/api/mcp/arxiv", methods=["GET"])
def arxiv():
    query = request.args.get("q", "")
    if not query:
        return jsonify({"error": "Missing query param 'q'"}), 400
    results = search_arxiv(query, max_results=int(request.args.get("n", 5)))
    return jsonify({"results": results})


@app.route("/api/mcp/github", methods=["GET"])
def github():
    query = request.args.get("q", "")
    if not query:
        return jsonify({"error": "Missing query param 'q'"}), 400
    results = search_github(query, max_results=int(request.args.get("n", 5)))
    return jsonify({"results": results})


@app.route("/api/mcp/huggingface/datasets", methods=["GET"])
def hf_datasets():
    query = request.args.get("q", "")
    results = search_datasets(query, max_results=int(request.args.get("n", 5)))
    return jsonify({"results": results})


@app.route("/api/mcp/huggingface/models", methods=["GET"])
def hf_models():
    query = request.args.get("q", "")
    results = search_models(query, max_results=int(request.args.get("n", 5)))
    return jsonify({"results": results})


# ─── Architecture Generation ──────────────────────────────────────────────────

@app.route("/api/architecture", methods=["POST"])
def generate_architecture():
    """Use Groq to generate architecture nodes/edges from paper or prompt."""
    data = request.json
    prompt = data.get("prompt", "")
    session_id = data.get("session_id", "default")

    # Optionally include paper context
    context = ""
    vs = stores.get(session_id)
    if vs and vs.is_ready():
        candidates = vs.search(prompt or "architecture methodology system design", top_k=5)
        context = "\n\n".join(c["text"] for c in candidates)

    client = get_groq()
    system_msg = """You are an architecture diagram generator. Given a research paper context or description,
output a JSON object with this exact structure:
{
  "nodes": [
    {"id": "1", "label": "Component Name", "type": "input|process|output|model|data|attention", "description": "brief description"}
  ],
  "edges": [
    {"source": "1", "target": "2", "label": "optional edge label"}
  ],
  "title": "Architecture Name"
}
Types: input=blue, process=purple, output=green, model=orange, data=yellow, attention=red.
Output ONLY the JSON, no markdown, no explanation."""

    user_msg = f"Context:\n{context}\n\nDescribe the architecture of: {prompt or 'this research paper'}"

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "system", "content": system_msg}, {"role": "user", "content": user_msg}],
        temperature=0.1,
        max_tokens=1024,
    )

    raw = response.choices[0].message.content.strip()
    # Strip possible markdown fences
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        arch = json.loads(raw)
    except json.JSONDecodeError:
        return jsonify({"error": "Failed to parse architecture JSON", "raw": raw}), 500

    return jsonify(arch)


# ─── Prototype Builder ─────────────────────────────────────────────────────────

@app.route("/api/prototype", methods=["POST"])
def generate_prototype():
    """Generate React component prototype from description."""
    data = request.json
    description = data.get("description", "")
    session_id = data.get("session_id", "default")

    context = ""
    vs = stores.get(session_id)
    if vs and vs.is_ready():
        candidates = vs.search(description, top_k=4)
        context = "\n\n".join(c["text"] for c in candidates)

    client = get_groq()
    system_msg = """You are a React prototype generator. Generate a complete, self-contained React component.
Output ONLY the JSX/JS code in a single code block. Use inline styles only (no imports for CSS).
The component should be functional, realistic, and visually clean with a dark theme (#0f1117 background).
Do not include import statements for React — assume it's available globally."""

    user_msg = f"Paper context:\n{context}\n\nGenerate a prototype component for: {description}"

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "system", "content": system_msg}, {"role": "user", "content": user_msg}],
        temperature=0.3,
        max_tokens=2048,
    )

    code = response.choices[0].message.content.strip()
    return jsonify({"code": code})


@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": "File too large. Maximum size is 20 MB."}), 413


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
