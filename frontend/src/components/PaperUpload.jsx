import React, { useState, useRef } from 'react'
import { uploadPDF } from '../services/api'

export default function PaperUpload({ sessionId, onIndexed }) {
  const [status, setStatus] = useState(null) // null | 'loading' | 'done' | 'error'
  const [info, setInfo] = useState(null)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef()

  async function handleFile(file) {
    if (!file || !file.name.endsWith('.pdf')) return
    setStatus('loading')
    setInfo(null)
    try {
      const result = await uploadPDF(file, sessionId)
      setInfo(result)
      setStatus('done')
      onIndexed(result)
    } catch (e) {
      setStatus('error')
      setInfo({ error: e.message })
    }
  }

  return (
    <div style={{ padding: '16px' }}>
      <div
        onClick={() => inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]) }}
        style={{
          border: `2px dashed ${drag ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 10,
          padding: '28px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: drag ? '#6366f108' : 'transparent',
          transition: 'all 0.2s',
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
        <div style={{ color: 'var(--text)', fontWeight: 500 }}>Drop PDF here</div>
        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>or click to browse</div>
      </div>
      <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])} />

      {status === 'loading' && (
        <div style={{ marginTop: 12, color: 'var(--accent)', fontSize: 13 }}>
          ⏳ Parsing &amp; indexing...
        </div>
      )}
      {status === 'done' && info && (
        <div style={{ marginTop: 12, padding: 10, background: '#10b98112', borderRadius: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--green)' }}>✓ Indexed</span>
          <span style={{ color: 'var(--muted)', marginLeft: 8 }}>
            {info.num_pages} pages · {info.num_chunks} chunks
          </span>
        </div>
      )}
      {status === 'error' && (
        <div style={{ marginTop: 12, color: 'var(--red)', fontSize: 12 }}>
          ✗ {info?.error || 'Upload failed'}
        </div>
      )}
    </div>
  )
}
