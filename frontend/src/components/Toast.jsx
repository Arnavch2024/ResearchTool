import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react'

const ToastContext = createContext(null)

const ICONS = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
}

const COLORS = {
  success: { bg: 'var(--moss-dim)',  border: 'rgba(138,163,122,0.3)', text: 'var(--moss)' },
  error:   { bg: 'var(--rust-dim)',  border: 'rgba(197,123,90,0.35)', text: 'var(--rust)' },
  info:    { bg: 'var(--brass-dim)', border: 'var(--brass-line)',     text: 'var(--brass-2)' },
  warning: { bg: 'var(--brass-dim)', border: 'var(--brass-line)',     text: 'var(--brass)' },
}

function ToastItem({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false)
  const c = COLORS[toast.type] || COLORS.info

  useEffect(() => {
    const t = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onRemove(toast.id), 350)
    }, toast.duration || 3500)
    return () => clearTimeout(t)
  }, [toast, onRemove])

  return (
    <div className="toast" style={{
      background: c.bg, borderColor: c.border,
      animation: exiting ? 'toastOut 0.28s ease forwards' : 'toastIn 0.28s ease forwards',
    }}>
      <span style={{ color: c.text, fontWeight: 700, fontSize: 15, marginTop: 1 }}>
        {ICONS[toast.type]}
      </span>
      <div style={{ flex: 1 }}>
        {toast.title && (
          <div style={{ color: c.text, fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
            {toast.title}
          </div>
        )}
        <div style={{ color: 'var(--paper-2)', fontSize: 12, lineHeight: 1.5 }}>{toast.message}</div>
      </div>
      <button onClick={() => { setExiting(true); setTimeout(() => onRemove(toast.id), 350) }}
        style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 0 0 4px' }}>
        ×
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'info', title = '', duration) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type, title, duration }])
  }, [])

  const remove = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div id="toast-root">
        {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={remove} />)}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
