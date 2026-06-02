# Research RAG

MCP-based RAG system for research paper analysis with architecture visualization and prototype builder.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + ReactFlow |
| Backend | Python Flask |
| LLM | Groq API (llama-3.3-70b-versatile) |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| Vector DB | FAISS (cosine similarity) |
| Reranking | BM25 fusion + CrossEncoder |
| PDF parsing | PyMuPDF |
| Text splitting | LangChain RecursiveCharacterTextSplitter |
| ArXiv | REST API (free) |
| GitHub | Search API (60 req/hr free) |
| HuggingFace | Datasets/Models API (free) |

## Setup

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env         # add your GROQ_API_KEY
python app.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Features

- **Chat** — Upload a PDF, ask questions via RAG (retrieve → rerank → generate)
- **Search** — Search ArXiv, GitHub, HuggingFace Datasets/Models
- **Architecture** — Auto-generate interactive architecture diagrams from paper context
- **Prototype** — Generate React UI prototypes from paper descriptions with live preview
