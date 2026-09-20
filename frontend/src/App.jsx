import React, { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import PaperUpload from './components/PaperUpload'
import ChatInterface from './components/ChatInterface'
import ArchitectureVisualization from './components/ArchitectureVisualization'
import MCPSearch from './components/MCPSearch'
import PrototypeBuilder from './components/PrototypeBuilder'
import LandingPage from './components/LandingPage'
import KeySettingsModal from './components/KeySettingsModal'
import { ToastProvider } from './components/Toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { clearSession } from './services/api'
import { Mark, IcoPaper, IcoSearch, IcoCode, IcoBox, IcoNodes, IcoWrench, IcoClose, IcoKey } from './components/Icons'

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

function Workspace() {
  const { user, logout, hasApiKey } = useAuth()
  const [activeTab, setActiveTab] = useState('chat')
  const [hasDoc, setHasDoc]       = useState(false)
  const [docInfo, setDocInfo]     = useState(null)
  const [archData, setArchData]   = useState(null)
  const [showKeyModal, setShowKeyModal] = useState(false)

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
          {/* BYOK API Key Status Button */}
          <button
            className={`nav-key-badge ${hasApiKey ? 'is-set' : 'is-missing'}`}
            onClick={() => setShowKeyModal(true)}
            title={hasApiKey ? 'Groq API Key Active in IndexedDB (Click to view rate limits & usage)' : 'Click to configure your Groq API Key'}
          >
            <span className="key-badge-icon"><IcoKey size={13} /></span>
            <span>{hasApiKey ? 'Groq Key: Set' : 'Set API Key'}</span>
            <span className={`key-status-dot ${hasApiKey ? 'dot-active' : 'dot-warn'}`} />
          </button>

          <PrivacyBadge />
          
          {/* User Profile Pill */}
          <div className="nav-user-pill">
            <span className="user-avatar">{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
            <span className="user-name" title={user?.email}>{user?.name || user?.email || 'Scholar'}</span>
            <button className="user-logout-btn" onClick={logout} title="Sign Out">
              Sign out
            </button>
          </div>

          <span className="nav-meta">gpt-oss-120b</span>
          <span className="status-dot" title="Session live" />
        </div>
      </header>

      {/* API Key Modal */}
      <KeySettingsModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
      />

      <div className="app-body">
        <aside className="sidebar">
          {/* Document upload / info */}
          <div className="side-card">
            <div className="side-card-title">Active Document</div>
            <PaperUpload
              sessionId={SESSION_ID}
              onIndexed={onIndexed}
              hasDoc={hasDoc}
              docInfo={docInfo}
            />
            {hasDoc && (
              <button className="btn-clear" onClick={handleClear}>
                <IcoClose size={12} /> Clear document
              </button>
            )}
          </div>

          {/* Quick tab jump shortcuts */}
          <div className="side-card">
            <div className="side-card-title">Capabilities</div>
            <div className="side-caps">
              {SIDEBAR_CAPS.map((cap, i) => {
                const Icon = cap.icon
                const isActive = activeTab === cap.tab
                return (
                  <button
                    key={i}
                    className={`side-cap-row ${isActive ? 'is-active' : ''}`}
                    onClick={() => setActiveTab(cap.tab)}
                  >
                    <span className="side-cap-icon"><Icon size={13} /></span>
                    <span className="side-cap-text">
                      <span className="side-cap-label">{cap.label}</span>
                      <span className="side-cap-desc">{cap.desc}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="side-card side-card--muted">
            <div className="side-card-title">System Architecture</div>
            <div className="side-status-list">
              <div className="side-status-item">
                <span className="status-dot-sm" />
                <span>RAG: <strong>Hybrid FAISS + PageTree</strong></span>
              </div>
              <div className="side-status-item">
                <span className="status-dot-sm" />
                <span>MCP: <strong>ArXiv · GitHub · HuggingFace</strong></span>
              </div>
              <div className="side-status-item">
                <span className="status-dot-sm" />
                <span>Persistence: <strong>MongoDB Atlas / Local</strong></span>
              </div>
              <div className="side-status-item">
                <span className="status-dot-sm" />
                <span>Privacy: <strong>Zero LLM Training</strong></span>
              </div>
            </div>
          </div>
        </aside>

        <main className="main-content">
          {/* TAB 1: Chat & Research Assistant */}
          {activeTab === 'chat' && (
            <div className="tab-pane">
              <ChatInterface
                sessionId={SESSION_ID}
                hasDoc={hasDoc}
                docInfo={docInfo}
                onOpenArchitecture={handleOpenArchFromChat}
              />
            </div>
          )}

          {/* TAB 2: Architecture Studio */}
          {activeTab === 'architecture' && (
            <div className="tab-pane tab-pane--full">
              <ArchitectureVisualization
                data={archData}
                sessionId={SESSION_ID}
                hasDoc={hasDoc}
                docInfo={docInfo}
                isStudioMode={true}
              />
            </div>
          )}

          {/* TAB 3: Ecosystem Search */}
          {activeTab === 'search' && (
            <div className="tab-pane">
              <MCPSearch />
            </div>
          )}

          {/* TAB 4: Prototype Sandbox */}
          {activeTab === 'prototype' && (
            <div className="tab-pane tab-pane--full">
              <PrototypeBuilder />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function MainApp() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="nav-mark" style={{ width: 42, height: 42 }}><Mark /></div>
        <div className="loading-spinner" />
        <p>Loading Research RAG Workspace...</p>
      </div>
    )
  }

  if (!user) {
    return <LandingPage />
  }

  return <Workspace />
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
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
              <span className="privacy-dot" />All active memory is <strong>ephemeral</strong> &amp; protected
            </div>
            <div className="privacy-item privacy-item--good">
              <span className="privacy-dot" />PII auto-redacted before reaching LLM
            </div>
            <div className="privacy-item privacy-item--good">
              <span className="privacy-dot" />MongoDB user-isolated chat persistence
            </div>
            <div className="privacy-item privacy-item--good">
              <span className="privacy-dot" />Rate-limited &amp; OWASP hardened API
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
