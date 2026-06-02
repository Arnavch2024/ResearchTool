import React, { useState } from 'react'
import { generatePrototype } from '../services/api'
import CodeBlock from './CodeBlock'

export default function PrototypeBuilder({ sessionId }) {
  const [description, setDescription] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('code') // 'code' | 'preview'

  async function generate() {
    if (!description.trim() || loading) return
    setLoading(true)
    setError('')
    setCode('')
    try {
      const res = await generatePrototype(description, sessionId)
      setCode(res.code || '')
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  // Robustly extract code from markdown fences (handles language tags, CRLF, nested content)
  function stripFences(raw) {
    const match = raw.match(/^```[\w]*\r?\n?([\s\S]*?)```\s*$/m)
    return match ? match[1].trim() : raw.trim()
  }
  const cleanCode = stripFences(code)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Input */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Prototype Builder</div>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe what to prototype, e.g. 'A self-attention mechanism visualizer showing attention weights as a heatmap'"
          rows={3}
          style={{ width: '100%', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-primary" onClick={generate} disabled={loading || !description.trim()}>
            {loading ? 'Generating...' : '⚡ Generate Prototype'}
          </button>
          {code && (
            <>
              <button className={`btn ${tab === 'code' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('code')}>Code</button>
              <button className={`btn ${tab === 'preview' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('preview')}>Preview</button>
            </>
          )}
        </div>
        {error && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{error}</div>}
      </div>

      {/* Output */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {!code && !loading && (
          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            Describe a UI component to prototype based on the paper
          </div>
        )}
        {loading && (
          <div style={{ color: 'var(--accent)', fontSize: 13 }}>⏳ Generating component...</div>
        )}
        {code && tab === 'code' && (
          <CodeBlock code={cleanCode} language="jsx" />
        )}
        {code && tab === 'preview' && (
          <SandboxPreview code={cleanCode} />
        )}
      </div>
    </div>
  )
}

function SandboxPreview({ code }) {
  // Wrap code in a sandboxed iframe with React via CDN
  const html = `<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0f1117; color:#e2e8f0; font-family:system-ui,sans-serif; padding:16px; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${code}
    const rootEl = document.getElementById('root');
    const root = ReactDOM.createRoot(rootEl);
    // Try to render the last defined component
    try { root.render(React.createElement(App)); } catch(e) { rootEl.textContent = e.message; }
  </script>
</body>
</html>`

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '6px 12px', background: '#161b2e', fontSize: 11, color: 'var(--muted)' }}>
        Live Preview (sandboxed)
      </div>
      <iframe
        srcDoc={html}
        style={{ width: '100%', height: 400, border: 'none', background: '#0f1117' }}
        sandbox="allow-scripts"
        title="prototype-preview"
      />
    </div>
  )
}
