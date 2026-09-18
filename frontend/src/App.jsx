import React, { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import PaperUpload from './components/PaperUpload'
import ChatInterface from './components/ChatInterface'
import ArchitectureVisualization from './components/ArchitectureVisualization'
import { ToastProvider } from './components/Toast'
import { clearSession } from './services/api'
import { Mark, IcoPaper, IcoSearch, IcoCode, IcoBox, IcoNodes, IcoWrench, IcoClose } from './components/Icons'

const SESSION_ID = uuidv4()

const CAPS = [
  { icon: IcoPaper,  label: 'Paper Q&A',      desc: 'Ask anything about your doc' },
  { icon: IcoSearch, label: 'ArXiv Search',   desc: 'Find related research papers' },
  { icon: IcoCode,   label: 'GitHub Code',    desc: 'Find implementations' },
  { icon: IcoBox,    label: 'HuggingFace',    desc: 'Datasets & model search' },
  { icon: IcoNodes,  label: 'Architecture',   desc: 'Auto-generate diagrams' },
  { icon: IcoWrench, label: 'Implementation', desc: 'Code guidance from paper' },
]

export default function App() {
  const [hasDoc, setHasDoc]   = useState(false)
  const [docInfo, setDocInfo] = useState(null)
  const [archModal, setArchModal] = useState(null)

  function onIndexed(info) {
    setHasDoc(true)
    setDocInfo(info)
  }

  async function handleClear() {
    await clearSession(SESSION_ID)
    setHasDoc(false)
    setDocInfo(null)
  }

  return (
    <ToastProvider>
      <div className="app-shell">
        <header className="navbar">
          <div className="nav-brand">
            <div className="nav-mark"><Mark /></div>
            <div>
              <div className="nav-wordmark"><em>Research</em> RAG</div>
              <div className="nav-sub">Library terminal</div>
            </div>
          </div>

          <div className="nav-center">
            <div style={{
              fontSize: 11,
              color: 'var(--faint)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              Paper · ArXiv · GitHub · HuggingFace · Architecture
            </div>
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
              <div className="side-label">Capabilities</div>
              {CAPS.map(cap => (
                <div key={cap.label} className="cap-row">
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

          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <ChatInterface
              sessionId={SESSION_ID}
              hasDoc={hasDoc}
              onOpenArch={setArchModal}
            />
          </main>
        </div>

        {archModal && (
          <div className="modal-scrim">
            <div className="modal-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="cap-ico"><IcoNodes size={13} /></div>
                <div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--paper)' }}>
                    {archModal.title || 'Architecture diagram'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {archModal.nodes?.length} nodes · {archModal.edges?.length} edges
                  </div>
                </div>
              </div>
              <button onClick={() => setArchModal(null)} className="btn btn-ghost">
                <IcoClose size={12} /> Close
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <ArchitectureVisualization
                sessionId={SESSION_ID}
                preloadedData={archModal}
              />
            </div>
          </div>
        )}
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
