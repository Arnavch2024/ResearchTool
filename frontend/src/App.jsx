import React, { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import PaperUpload from './components/PaperUpload'
import ChatInterface from './components/ChatInterface'
import ArchitectureVisualization from './components/ArchitectureVisualization'
import MCPSearch from './components/MCPSearch'
import PrototypeBuilder from './components/PrototypeBuilder'
import { ToastProvider } from './components/Toast'
import { clearSession } from './services/api'
import { Mark, IcoPaper, IcoSearch, IcoCode, IcoBox, IcoNodes, IcoWrench, IcoClose } from './components/Icons'

const SESSION_ID = uuidv4()

const TABS = [
  { id: 'chat',         label: 'Research Assistant',  icon: IcoPaper,  desc: 'Q&A & context search' },
  { id: 'architecture', label: 'Architecture Studio', icon: IcoNodes,  desc: 'Interactive diagrams' },
  { id: 'search',       label: 'Ecosystem Search',    icon: IcoSearch, desc: 'ArXiv, GitHub, HF' },
  { id: 'prototype',    label: 'Prototype Builder',   icon: IcoWrench, desc: 'Live React sandbox' },
]

const SIDEBAR_CAPS = [
  { tab: 'chat',         icon: IcoPaper,  label: 'Paper Q&A',      desc: 'Ask anything about your doc' },
  { tab: 'architecture', icon: IcoNodes,  label: 'Architecture',   desc: 'Interactive flow diagrams' },
  { tab: 'search',       icon: IcoSearch, label: 'ArXiv Search',   desc: 'Find related research papers' },
  { tab: 'search',       icon: IcoCode,   label: 'GitHub Code',    desc: 'Find implementations' },
  { tab: 'search',       icon: IcoBox,    label: 'HuggingFace',    desc: 'Datasets & model search' },
  { tab: 'prototype',    icon: IcoWrench, label: 'Implementation', desc: 'Generate React prototypes' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [hasDoc, setHasDoc]       = useState(false)
  const [docInfo, setDocInfo]     = useState(null)
  const [archData, setArchData]   = useState(null)

  function onIndexed(info) {
    setHasDoc(true)
    setDocInfo(info)
  }

  async function handleClear() {
    await clearSession(SESSION_ID)
    setHasDoc(false)
    setDocInfo(null)
    setArchData(null)
  }

  function handleOpenArchFromChat(diagram) {
    setArchData(diagram)
    setActiveTab('architecture')
  }

  return (
    <ToastProvider>
      <div className="app-shell">
        <header className="navbar">
          <div className="nav-brand">
            <div className="nav-mark"><Mark /></div>
            <div>
              <div className="nav-wordmark"><em>Research</em> RAG</div>
              <div className="nav-sub">Studio &amp; Terminal</div>
            </div>
          </div>

          <div className="nav-center">
            {/* Top Workspace Navigation Tabs */}
            <nav className="nav-tabs" role="tablist">
              {TABS.map(tab => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={13} />
                    <span>{tab.label}</span>
                    {tab.id === 'architecture' && archData?.nodes?.length > 0 && (
                      <span className="tab-pill">
                        {archData.nodes.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="nav-end">
            <PrivacyBadge />
            <span className="nav-meta">llama-3.3-70b</span>
            <span className="status-dot" title="Session live" />
          </div>
        </header>

        <div className="app-body">
          <aside className="sidebar">
            <div className="side-block">
              <div className="side-label">Research paper</div>
              <PaperUpload sessionId={SESSION_ID} onIndexed={onIndexed} />
            </div>

            {hasDoc && docInfo && (
              <div className="doc-card animate-fade">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--moss)' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--moss)' }}>Indexed</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <span className="tag tag-green">{docInfo.num_pages} pages</span>
                  <span className="tag tag-accent">{docInfo.num_chunks} chunks</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <span className="tag" style={{
                    background: docInfo.rag_mode === 'vectorless' ? 'rgba(197,123,90,0.15)' : 'rgba(138,163,122,0.15)',
                    color: docInfo.rag_mode === 'vectorless' ? '#c57b5a' : '#8aa37a',
                    border: `1px solid ${docInfo.rag_mode === 'vectorless' ? 'rgba(197,123,90,0.3)' : 'rgba(138,163,122,0.3)'}`,
                  }}>
                    {docInfo.rag_mode === 'vectorless' ? '⚡ Vectorless RAG' : '⬡ Vector RAG'}
                  </span>
                  {docInfo.has_visuals && (
                    <span className="tag" style={{
                      background: 'rgba(196,163,106,0.12)',
                      color: '#c4a36a',
                      border: '1px solid rgba(196,163,106,0.25)',
                    }}>
                      {docInfo.visual_stats?.total_images || 0} images
                    </span>
                  )}
                </div>
                <button
                  className="btn btn-danger"
                  style={{ width: '100%', height: 28, fontSize: 11 }}
                  onClick={handleClear}
                >
                  Clear session
                </button>
              </div>
            )}

            <div className="side-block" style={{ flex: 1 }}>
              <div className="side-label">Workspace Tools</div>
              {SIDEBAR_CAPS.map((cap, i) => (
                <div
                  key={i}
                  className={`cap-row ${activeTab === cap.tab ? 'cap-row-active' : ''}`}
                  onClick={() => setActiveTab(cap.tab)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="cap-ico"><cap.icon size={13} /></div>
                  <div>
                    <strong>{cap.label}</strong>
                    <span>{cap.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="side-foot">
              <span className="status-dot" />
              {SESSION_ID.slice(0, 12)}…
            </div>
          </aside>

          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, position: 'relative' }}>
            {/* Tab 1: Research Chat */}
            <div style={{ display: activeTab === 'chat' ? 'flex' : 'none', flex: 1, flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <ChatInterface
                sessionId={SESSION_ID}
                hasDoc={hasDoc}
                onOpenArch={handleOpenArchFromChat}
              />
            </div>

            {/* Tab 2: Architecture Studio */}
            <div style={{ display: activeTab === 'architecture' ? 'flex' : 'none', flex: 1, flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <ArchitectureVisualization
                sessionId={SESSION_ID}
                hasDoc={hasDoc}
                docInfo={docInfo}
                sharedArchData={archData}
                onUpdateArchData={setArchData}
              />
            </div>

            {/* Tab 3: Ecosystem Search */}
            <div style={{ display: activeTab === 'search' ? 'flex' : 'none', flex: 1, flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <MCPSearch />
            </div>

            {/* Tab 4: Prototype Builder */}
            <div style={{ display: activeTab === 'prototype' ? 'flex' : 'none', flex: 1, flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <PrototypeBuilder sessionId={SESSION_ID} />
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}

/* ─── Privacy Badge Component ─────────────────────────────────────────── */

function PrivacyBadge() {
  const [show, setShow] = useState(false)
  const [policy, setPolicy] = useState(null)

  useEffect(() => {
    fetch('/api/privacy')
      .then(r => r.json())
      .then(setPolicy)
      .catch(() => {})
  }, [])

  return (
    <div className="privacy-badge-wrap">
      <button
        className="privacy-badge"
        onClick={() => setShow(!show)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        title="Privacy & Security"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>Private</span>
      </button>
      {show && (
        <div className="privacy-tooltip" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
          <div className="privacy-tooltip-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--moss)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Privacy &amp; Security
          </div>
          <div className="privacy-tooltip-items">
            <div className="privacy-item privacy-item--good">
              <span className="privacy-dot" />Your prompts are <strong>never used for AI training</strong>
            </div>
            <div className="privacy-item privacy-item--good">
              <span className="privacy-dot" />All data is <strong>ephemeral</strong> — cleared on session end
            </div>
            <div className="privacy-item privacy-item--good">
              <span className="privacy-dot" />PII auto-redacted before reaching the LLM
            </div>
            <div className="privacy-item privacy-item--good">
              <span className="privacy-dot" />No data stored on disk
            </div>
            <div className="privacy-item privacy-item--good">
              <span className="privacy-dot" />Rate-limited &amp; input-validated API
            </div>
          </div>
          {policy && (
            <div className="privacy-provider">
              LLM: {policy.llm_provider?.name} · Retention: {policy.data_handling?.storage_type}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
