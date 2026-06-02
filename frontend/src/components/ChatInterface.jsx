import React, { useState, useRef, useEffect } from 'react'
import { sendChat } from '../services/api'
import { useChatHistory } from '../hooks/useChatHistory'

export default function ChatInterface({ sessionId, hasDoc }) {
  const { messages, addMessage, clear } = useChatHistory()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function submit(e) {
    e.preventDefault()
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    addMessage('user', q)
    setLoading(true)
    try {
      const res = await sendChat(q, sessionId)
      addMessage('assistant', res.answer, { sources: res.sources, usage: res.usage })
    } catch (err) {
      addMessage('assistant', `Error: ${err.message}`)
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Q&amp;A Chat</span>
        {messages.length > 0 && (
          <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={clear}>
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            {hasDoc ? 'Ask anything about your paper' : 'Upload a PDF to start chatting'}
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={submit} style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={hasDoc ? 'Ask about the paper...' : 'Upload a PDF first'}
          disabled={!hasDoc || loading}
          style={{ flex: 1 }}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submit(e)}
        />
        <button className="btn btn-primary" type="submit" disabled={!hasDoc || loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '85%',
        padding: '10px 14px',
        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        background: isUser ? 'var(--accent)' : 'var(--surface2)',
        color: 'var(--text)',
        fontSize: 13,
        lineHeight: 1.7,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {msg.content}
      </div>
      {msg.meta?.sources?.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {msg.meta.sources.map(s => (
            <span key={s.id} className="tag tag-purple" title={s.text}>
              Chunk {s.id}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 12, width: 'fit-content' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)',
          animation: 'bounce 1.2s infinite',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
    </div>
  )
}
