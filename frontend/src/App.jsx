import React, { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import PaperUpload from './components/PaperUpload'
import ChatInterface from './components/ChatInterface'
import MCPSearch from './components/MCPSearch'
import ArchitectureVisualization from './components/ArchitectureVisualization'
import PrototypeBuilder from './components/PrototypeBuilder'
import { clearSession } from './services/api'

const SESSION_ID = uuidv4()

const TABS = [
  { key: 'chat', label: '💬 Chat' },
  { key: 'mcp', label: '🔍 Search' },
  { key: 'arch', label: '🏗️ Architecture' },
  { key: 'proto', label: '⚡ Prototype' },
]

export default function App() {
  const [tab, setTab] = useState('chat')
  const [hasDoc, setHasDoc] = useState(false)
  const [docInfo, setDocInfo] = useState(null)

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
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>

      {/* Sidebar */}
      <div style={{
        width: 260, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
            🧠 Research RAG
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            Powered by Groq · llama-3.3-70b
          </div>
        </div>

        {/* Upload */}
        <PaperUpload sessionId={SESSION_ID} onIndexed={onIndexed} />

        {/* Doc status */}
        {hasDoc && docInfo && (
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
              📄 {docInfo.num_pages}p · {docInfo.num_chunks} chunks indexed
            </div>
            <button className="btn btn-danger" style={{ width: '100%', justifyContent: 'center', fontSize: 11 }} onClick={handleClear}>
              Clear Session
            </button>
          </div>
        )}

        {/* Nav */}
        <div style={{ padding: '8px', flex: 1 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 12px',
                borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13,
                background: tab === t.key ? 'var(--surface2)' : 'transparent',
                color: tab === t.key ? 'var(--text)' : 'var(--muted)',
                fontWeight: tab === t.key ? 600 : 400,
                borderLeft: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: 2,
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Session info */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
            Session: {SESSION_ID.slice(0, 8)}...
          </div>
        </div>
      </div>

      {/* Main panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'chat' && <ChatInterface sessionId={SESSION_ID} hasDoc={hasDoc} />}
        {tab === 'mcp' && <MCPSearch />}
        {tab === 'arch' && <ArchitectureVisualization sessionId={SESSION_ID} />}
        {tab === 'proto' && <PrototypeBuilder sessionId={SESSION_ID} />}
      </div>

    </div>
  )
}
