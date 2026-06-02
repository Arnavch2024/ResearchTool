import React, { useEffect, useRef } from 'react'
import hljs from 'highlight.js'

export default function CodeBlock({ code, language = 'javascript' }) {
  const ref = useRef()

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = code
      hljs.highlightElement(ref.current)
    }
  }, [code])

  const copy = () => navigator.clipboard.writeText(code)

  return (
    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 12px', background: '#161b2e', fontSize: 11, color: 'var(--muted)'
      }}>
        <span>{language}</span>
        <button onClick={copy} className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }}>
          Copy
        </button>
      </div>
      <pre style={{ margin: 0, overflowX: 'auto', maxHeight: 400 }}>
        <code ref={ref} className={`language-${language}`} />
      </pre>
    </div>
  )
}
