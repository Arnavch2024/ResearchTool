import React, { useState, useEffect, useRef } from 'react'
import hljs from 'highlight.js'

export default function CodeBlock({ code, language = 'javascript' }) {
  const ref = useRef()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = code
      hljs.highlightElement(ref.current)
    }
  }, [code])

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '7px 14px',
        background: 'rgba(10,12,20,0.8)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {['#ef4444','#f59e0b','#10b981'].map(c => (
              <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.8 }} />
            ))}
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{language}</span>
        </div>
        <button
          onClick={copy}
          className="btn btn-ghost"
          style={{ padding: '3px 10px', fontSize: 11, gap: 5 }}
        >
          {copied ? (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span style={{ color: 'var(--green)' }}>Copied!</span>
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre style={{ margin: 0, overflowX: 'auto', maxHeight: 500, background: '#0d1220' }}>
        <code ref={ref} className={`language-${language}`} style={{ fontSize: 12 }} />
      </pre>
    </div>
  )
}
