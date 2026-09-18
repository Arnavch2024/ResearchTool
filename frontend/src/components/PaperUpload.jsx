import React, { useState, useRef } from 'react'
import { uploadPDF } from '../services/api'
import { useToast } from './Toast'
import { IcoUpload, IcoPaper, IcoCheck } from './Icons'

export default function PaperUpload({ sessionId, onIndexed }) {
  const [status, setStatus] = useState(null)
  const [info, setInfo]     = useState(null)
  const [fileName, setFileName] = useState('')
  const [drag, setDrag]     = useState(false)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef()
  const toast    = useToast()

  async function handleFile(file) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast('Only PDF files are supported.', 'error', 'Invalid file type')
      return
    }
    setFileName(file.name)
    setStatus('loading')
    setInfo(null)
    setProgress(0)

    const interval = setInterval(() => setProgress(p => Math.min(p + 4, 88)), 120)
    try {
      const result = await uploadPDF(file, sessionId)
      clearInterval(interval)
      setProgress(100)
      setInfo(result)
      setStatus('done')
      onIndexed(result)
      const modeLabel = result.rag_mode === 'vectorless'
        ? `Visual PDF → Vectorless RAG (${result.visual_stats?.total_images || 0} images)`
        : `Vector RAG`
      toast(`${result.num_pages} pages · ${result.num_chunks} chunks · ${modeLabel}`, 'success', 'Paper indexed')
    } catch (e) {
      clearInterval(interval)
      setStatus('error')
      setInfo({ error: e.message })
      toast(e.message || 'Upload failed', 'error', 'Indexing failed')
    }
  }

  const isDone = status === 'done'

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        className={`dropzone ${drag ? 'is-drag' : ''} ${isDone ? 'is-done' : ''}`}
        onClick={() => inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]) }}
      >
        {status === 'loading' && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, width: `${progress}%`,
            height: 2, background: 'var(--brass)', transition: 'width 0.15s ease',
          }} />
        )}

        {isDone ? (
          <div className="animate-fade" style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
            <div className="cap-ico" style={{ color: 'var(--moss)' }}><IcoPaper size={13} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--moss)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <IcoCheck size={11} /> Indexed
              </div>
              <div style={{
                fontSize: 10, color: 'var(--paper-2)', marginTop: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 160,
              }}>
                {fileName}
              </div>
            </div>
          </div>
        ) : status === 'loading' ? (
          <div style={{ color: 'var(--brass-2)', fontSize: 12 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              border: '2px solid var(--rule-2)', borderTopColor: 'var(--brass)',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 8px',
            }} />
            <div style={{ fontWeight: 500 }}>Parsing & indexing</div>
            <div style={{ color: 'var(--faint)', fontSize: 11, marginTop: 2, fontFamily: 'var(--mono)' }}>{progress}%</div>
          </div>
        ) : (
          <>
            <div style={{ color: status === 'error' ? 'var(--rust)' : 'var(--brass)', marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
              <IcoUpload size={18} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: drag ? 'var(--brass-2)' : 'var(--paper-2)' }}>
              {status === 'error' ? 'Upload failed — retry' : 'Drop PDF'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 4 }}>
              {status === 'error' ? (info?.error || '') : 'or browse · max 20 MB'}
            </div>
          </>
        )}
      </div>

      <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }}
        onChange={e => handleFile(e.dataTransfer.files[0])} />
    </div>
  )
}
