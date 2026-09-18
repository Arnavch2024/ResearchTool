import React, { useState } from 'react'
import { generatePrototype } from '../services/api'
import CodeBlock from './CodeBlock'

export default function PrototypeBuilder({ sessionId }) {
  const [description, setDescription] = useState('')
  const [code, setCode]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [view, setView]     = useState('code') // 'code' | 'preview'

  async function generate() {
    if (!description.trim() || loading) return
    setLoading(true)
    setError('')
    setCode('')
    try {
      const res = await generatePrototype(description, sessionId)
      setCode(res.code || '')
      setView('code')
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  // Robustly extract code from markdown fences
  function stripFences(raw) {
    const match = raw.match(/^```[\w]*\r?\n?([\s\S]*?)```\s*$/m)
    return match ? match[1].trim() : raw.trim()
  }

  const cleanCode = code ? stripFences(code) : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header / Input ── */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          }}>⚡</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Prototype Builder</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Generate live React components</div>
          </div>
        </div>

        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe the UI component you want, e.g. 'A self-attention visualizer showing attention weights as an interactive heatmap'"
          rows={3}
          style={{ resize: 'none', marginBottom: 10 }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={generate}
            disabled={loading || !description.trim()}
          >
            {loading ? (
              <>
                <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                Generating…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Generate Prototype
              </>
            )}
          </button>

          {cleanCode && (
            <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 8, padding: 3, gap: 2 }}>
              {['code', 'preview'].map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                    background: view === v ? 'var(--surface3)' : 'transparent',
                    color: view === v ? 'var(--text)' : 'var(--muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  {v === 'code' ? '⟨/⟩ Code' : '👁 Preview'}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--red-dim)', color: 'var(--red)', fontSize: 12 }}>
            ⚠ {error}
          </div>
        )}
      </div>

      {/* ── Output ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {!code && !loading && (
          <div className="animate-fade" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 12, color: 'var(--muted)',
          }}>
            <div style={{ fontSize: 48 }}>⚡</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text2)' }}>No prototype yet</div>
            <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 340 }}>
              Describe a UI component above — it will be generated as a self-contained React component with a live preview
            </div>
          </div>
        )}

        {loading && (
          <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border2)', borderTopColor: 'var(--orange)', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ color: 'var(--accent2)', fontSize: 13, fontWeight: 500 }}>Generating React component…</span>
            </div>
            {[100, 80, 90, 60].map((w, i) => (
              <div key={i} className="skeleton" style={{ height: 14, width: `${w}%` }} />
            ))}
          </div>
        )}

        {cleanCode && view === 'code' && (
          <div className="animate-fade">
            <CodeBlock code={cleanCode} language="jsx" />
          </div>
        )}

        {cleanCode && view === 'preview' && (
          <div className="animate-fade">
            <SandboxPreview code={cleanCode} />
          </div>
        )}
      </div>
    </div>
  )
}

function SandboxPreview({ code }) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#080c14; color:#e2e8f0; font-family:'Inter',system-ui,sans-serif; padding:20px; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${code}
    const rootEl = document.getElementById('root');
    const root = ReactDOM.createRoot(rootEl);
    try { root.render(React.createElement(App)); }
    catch(e) { rootEl.innerHTML = '<div style="color:#ef4444;padding:12px;background:rgba(239,68,68,0.1);border-radius:8px;font-family:monospace;font-size:12px">Error: ' + e.message + '</div>'; }
  </script>
</body>
</html>`

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{
        padding: '8px 14px', background: 'var(--surface2)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#ef4444','#f59e0b','#10b981'].map(c => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.7 }} />
          ))}
        </div>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>Live Preview — sandboxed iframe</span>
      </div>
      <iframe
        key={code}
        srcDoc={html}
        style={{ width: '100%', height: 460, border: 'none', display: 'block', background: '#080c14' }}
        sandbox="allow-scripts"
        title="prototype-preview"
      />
    </div>
  )
}
