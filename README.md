# Research RAG 🔬⚡

[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61dafb?logo=react&logoColor=black)](https://reactjs.org/)
[![Flask](https://img.shields.io/badge/Backend-Python%20Flask-000000?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Atlas%20%2F%20Local-47a248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Groq](https://img.shields.io/badge/LLM-Groq%20High--Speed%20Inference-f55036?logo=fastapi&logoColor=white)](https://groq.com/)
[![FAISS](https://img.shields.io/badge/Vector%20DB-FAISS%20%2B%20BM25-blue)](https://github.com/facebookresearch/faiss)
[![IndexedDB](https://img.shields.io/badge/BYOK%20Vault-AES--GCM%20256--bit%20IndexedDB-9cf)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Research RAG** is an advanced, privacy-first academic research workspace designed to help researchers, engineers, and students interactively analyze complex papers, visualize architectures, query external research ecosystems, and generate live code prototypes.

---

## 🌟 Key Capabilities

### 1. 🧠 Hybrid RAG Engine (Vector + Visual PageTree)
- **Multi-Modal Document Routing**: Automatically inspects PDF layout to select optimal retrieval strategies.
- **Text-Dense Papers**: 3-stage pipeline combining **Cosine FAISS embeddings** (`sentence-transformers/all-MiniLM-L6-v2`), **BM25 lexical ranking**, and **CrossEncoder reranking**.
- **Figure & Diagram Heavy Papers**: Utilizes **PageTree Vectorless Retrieval** to maintain page structural context for visual architectures, tables, and charts.

### 2. 🎨 Architecture Studio (ReactFlow Diagrams)
- Automatically transforms paper methodologies into interactive, editable node diagrams.
- Inspect individual component nodes, edit connections, and export blueprints directly as **SVG** or **JSON**.

### 3. 🌐 Ecosystem Search (Model Context Protocol - MCP)
- Agentic intent classifier routes queries across live research networks:
  - **📄 ArXiv**: Retrieve recent preprints, authors, abstracts, and citations.
  - **🐙 GitHub**: Find open-source codebases, libraries, and model implementations.
  - **🤗 HuggingFace**: Discover dataset splits and pre-trained model weights.

### 4. 🔑 Bring Your Own Key (BYOK) with AES-GCM 256-bit IndexedDB
- **Zero Server-Side Key Storage**: Users supply their own Groq API keys without server billing overhead.
- **Client-Side Encryption**: Keys are encrypted via **Web Crypto API (AES-GCM 256-bit)** using PBKDF2 key derivation and stored in the browser's `ResearchRAG_Vault` IndexedDB.
- **Persistent & Ephemeral**: Keys persist across browser reloads while logged in, and are **automatically dropped from IndexedDB upon logout**.
- **Real-Time Verification**: Built-in verification testing before saving.

### 5. 🛡️ Enterprise-Grade Privacy & Security Shield
- **Zero Prompt Training**: Prompts and uploaded documents are never used for AI model training.
- **Automated PII Redaction**: Strips sensitive personal identifiers before payloads reach the LLM.
- **Secret Scrubbing Filter**: Redacts API keys, tokens, and authorization headers from logs and error messages.
- **OWASP Hardening**: Rate limiting (`flask-limiter`), strict CSP, anti-clickjacking (`X-Frame-Options: DENY`), strict MIME-type sniffing protection, and `no-store` API caching headers.

### 6. 💾 User Authentication & MongoDB Persistence
- Secure registration and login with **bcrypt** password hashing and **JWT** session tokens.
- Persistent user-scoped chat history, multi-session tracking, and in-memory fallback for local environments.

---

## 🛠️ Technology Stack

| Component | Technology | Description |
|---|---|---|
| **Frontend UI** | React 18, Vite, Vanilla CSS | High-performance dark brass aesthetic |
| **Diagram Engine** | ReactFlow 11 | Interactive node-edge visualization |
| **Client Storage** | IndexedDB (`idb-keyval`) + Web Crypto API | AES-GCM 256-bit encrypted BYOK vault |
| **Backend API** | Python 3.10+, Flask | Modular REST API with route blueprints |
| **Authentication** | JWT (`PyJWT`) + bcrypt | Stateless token auth & secure hashing |
| **Database** | MongoDB (Atlas / Local) + PyMongo | User profiles, chat history & session records |
| **LLM Inference** | Groq API (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`) | Ultra-fast token generation |
| **Embeddings** | `sentence-transformers` (`all-MiniLM-L6-v2`) | Semantic vector representation |
| **Vector Index** | FAISS CPU (`faiss-cpu`) | Cosine similarity nearest-neighbor search |
| **Lexical Search** | `rank-bm25` | BM25 lexical keyword ranking |
| **Document Parsing** | PyMuPDF (`fitz`) | Multi-page PDF layout and image analysis |
| **Security & Rate Limits** | `flask-limiter`, custom security middleware | OWASP-compliant protection |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+)
- **Python** (3.10+)
- **MongoDB** (Local instance or MongoDB Atlas cluster)
- **Groq API Key** (Free from [console.groq.com/keys](https://console.groq.com/keys))

---

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
```

Edit `.env`:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
GITHUB_TOKEN=ghp_optional_github_token
MONGODB_URI=mongodb://localhost:27017/research_rag
JWT_SECRET=your_jwt_secret_key_here
```

Start the backend server:
```bash
python app.py
```
*Backend runs on `http://127.0.0.1:5000`.*

---

### 2. Frontend Setup

```bash
cd frontend

# Install packages
npm install

# Start Vite development server
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## 🔒 Security & BYOK Architecture

```
[ User Browser ]
  │
  ├─► IndexedDB (ResearchRAG_Vault)
  │     └─► AES-GCM 256-bit Encrypted Groq API Key
  │
  ├─► Per-Request Decryption (In-Memory Only)
  │     └─► Header: "X-Groq-Api-Key: gsk_..."
  │
  ▼ (HTTPS / Localhost)
[ Flask Backend ]
  │
  ├─► Security Layer
  │     ├─► Rate Limiter (flask-limiter)
  │     ├─► PII Redaction Filter
  │     ├─► Secret Scrubbing (Redacts gsk_... from logs/errors)
  │     └─► OWASP Security Headers (CSP, No-Store, Vary)
  │
  ├─► RAG Pipeline / Agentic Router
  │     ├─► FAISS Vector Store + BM25 Reranker
  │     └─► MCP Search (ArXiv, GitHub, HuggingFace)
  │
  ▼ (In-Memory Dynamic Execution)
[ Groq LLM API ] ──► Returns Answer / Diagram / Prototype
```

---

## 📂 Project Structure

```
research-rag/
├── backend/
│   ├── app.py                 # Flask server, intent router, and route endpoints
│   ├── auth.py                # JWT authentication blueprint & login decorators
│   ├── db.py                  # MongoDB connection singleton & in-memory fallback
│   ├── security.py            # Security headers, rate limiting, and log scrubber
│   ├── privacy.py             # PII redaction and data privacy policy
│   ├── requirements.txt       # Python dependencies
│   ├── rag/
│   │   ├── parser.py          # PyMuPDF parser with visual figure detection
│   │   ├── splitter.py        # Recursive text chunking
│   │   ├── vectorstore.py     # FAISS vector store
│   │   ├── context_store.py   # PageTree vectorless retrieval store
│   │   ├── reranker.py        # CrossEncoder reranker
│   │   └── pipeline.py        # Dynamic Groq RAG orchestration
│   └── mcp/
│       ├── arxiv_tool.py      # ArXiv search integration
│       ├── github_tool.py     # GitHub repository search
│       └── huggingface_tool.py# HuggingFace datasets and models
│
└── frontend/
    ├── src/
    │   ├── App.jsx            # Multi-tab workspace navigation & auth router
    │   ├── main.jsx           # React DOM root
    │   ├── index.css          # Theme design system & typography tokens
    │   ├── contexts/
    │   │   └── AuthContext.jsx# Authentication & BYOK key lifecycle context
    │   ├── services/
    │   │   ├── api.js         # API client with token & BYOK header injection
    │   │   └── keyStore.js    # Web Crypto AES-GCM IndexedDB vault
    │   └── components/
    │       ├── LandingPage.jsx               # Hero landing page & auth forms
    │       ├── KeySettingsModal.jsx          # BYOK key management modal
    │       ├── ChatInterface.jsx             # Research Q&A & citations
    │       ├── ArchitectureVisualization.jsx # ReactFlow diagram studio
    │       ├── MCPSearch.jsx                 # ArXiv/GitHub/HF search explorer
    │       ├── PrototypeBuilder.jsx          # Live React component sandbox
    │       ├── PaperUpload.jsx               # Drag-and-drop PDF dropzone
    │       └── Toast.jsx                     # Notifications provider
    └── package.json           # Frontend dependencies
```

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
