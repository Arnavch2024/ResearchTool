import React, { useState, useRef, useEffect, useMemo } from 'react'
import { sendChat } from '../services/api'
import { useChatHistory } from '../hooks/useChatHistory'
import { IcoPaper, IcoSearch, IcoCode, IcoBox, IcoNodes, IcoWrench, IcoSend, IcoUser, IcoBot, IcoExpand, IcoExt } from './Icons'

const STARTERS = [
  { icon: IcoPaper,  text: 'What is the main contribution of this paper?' },
  { icon: IcoSearch, text: 'Find related papers on ArXiv for this topic' },
  { icon: IcoNodes,  text: 'Show me the system architecture diagram' },
  { icon: IcoCode,   text: 'Are there GitHub implementations of this method?' },
  { icon: IcoBox,    text: 'What datasets were used for evaluation?' },
  { icon: IcoWrench, text: 'How would I implement this from scratch?' },
]

const TOOL_META = {
  arxiv:       { icon: IcoSearch, label: 'ArXiv papers',        color: 'var(--slate)' },
  github:      { icon: IcoCode,   label: 'GitHub repos',        color: 'var(--brass-2)' },
  hf_datasets: { icon: IcoBox,    label: 'HuggingFace datasets', color: 'var(--brass)' },
  hf_models:   { icon: IcoBox,    label: 'HuggingFace models',   color: 'var(--moss)' },
}

const TYPE_COLORS = {
  input:     { bg: '#1a2430', border: '#6d8498', text: '#c5d4e0' },
  process:   { bg: '#242018', border: '#c4a36a', text: '#e6d4b0' },
  output:    { bg: '#1a2418', border: '#8aa37a', text: '#cfe0c4' },
  model:     { bg: '#2a1e18', border: '#c57b5a', text: '#efc4b0' },
  data:      { bg: '#241f14', border: '#b89a5e', text: '#e8d7a8' },
  attention: { bg: '#2a1816', border: '#c57b5a', text: '#efc4b0' },
  default:   { bg: '#1e1c18', border: '#3a372f', text: '#ece6d6' },
}

function TypingIndicator({ query }) {
  const [step, setStep] = useState(0)

  const steps = useMemo(() => {
    const q = (query || '').toLowerCase()
    const list = ['Routing query']
    if (/paper|arxiv|research|publication|survey|literature/.test(q)) list.push('Searching ArXiv')
    if (/github|code|implementation|repo/.test(q)) list.push('Searching GitHub')
    if (/dataset|benchmark/.test(q)) list.push('Searching HuggingFace')
    if (/architecture|diagram|visualize|draw|pipeline/.test(q)) list.push('Generating diagram')
    list.push('Composing answer')
    return list
  }, [query])

  useEffect(() => {
    const timer = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 1100)
    return () => clearInterval(timer)
  }, [steps])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <RoleAvatar role="assistant" />
        <span style={{ fontSize: 10, color: 'var(--faint)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Assistant
        </span>
      </div>
      <div style={{
        padding: '12px 14px',
        background: 'var(--panel)',
        borderRadius: '2px 10px 10px 10px',
        border: '1px solid var(--rule)',
        minWidth: 200,
      }}>
        <div style={{ fontSize: 12, color: 'var(--paper-2)', fontWeight: 500, marginBottom: 8 }}>
          {steps[step]}…
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: i <= step ? 18 : 6, height: 3, borderRadius: 1,
              background: i <= step ? 'var(--brass)' : 'var(--raised)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function RoleAvatar({ role }) {
  const isUser = role === 'user'
  return (
    <div style={{
      width: 22, height: 22, borderRadius: 4, flexShrink: 0,
      background: isUser ? 'var(--brass-dim)' : 'rgba(0,0,0,0.28)',
      border: `1px solid ${isUser ? 'var(--brass-line)' : 'var(--rule-2)'}`,
      color: isUser ? 'var(--brass)' : 'var(--paper-2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {isUser ? <IcoUser size={11} /> : <IcoBot size={11} />}
    </div>
  )
}

function MCPResultCards({ toolCalls }) {
  const [expanded, setExpanded] = useState({})
  if (!toolCalls?.length) return null

  const toggle = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
      {toolCalls.map(tc => {
        const meta = TOOL_META[tc.tool] || { icon: IcoSearch, label: tc.tool, color: 'var(--brass)' }
        const IconCmp = meta.icon
        const results = tc.results || []
        const isOpen = expanded[tc.tool]
        return (
          <div key={tc.tool} style={{
            background: 'var(--ink)',
            borderRadius: 8,
            border: '1px solid var(--rule-2)',
            overflow: 'hidden',
          }}>
            <button
              onClick={() => toggle(tc.tool)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', color: 'var(--paper)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--brass)', display: 'flex' }}><IconCmp size={13} /></span>
                <span style={{ fontSize: 11, fontWeight: 600 }}>{meta.label}</span>
                <span className="tag tag-accent">{results.length}</span>
              </div>
              <span style={{ fontSize: 10, color: 'var(--faint)' }}>{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && results.length > 0 && (
              <div style={{ borderTop: '1px solid var(--rule)', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {results.map((r, i) => (
                  <a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '8px 10px', borderRadius: 6, textDecoration: 'none',
                      background: 'var(--panel)', border: '1px solid var(--rule)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--paper)', marginBottom: 3, lineHeight: 1.4 }}>
                        {r.title || r.name || r.id}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {r.authors?.slice(0, 2).map((a, j) => (
                          <span key={j} style={{ fontSize: 10, color: 'var(--muted)' }}>{a}</span>
                        ))}
                        {r.year && <span style={{ fontSize: 10, color: 'var(--muted)' }}>· {r.year}</span>}
                        {r.stars != null && (
                          <span style={{ fontSize: 10, color: 'var(--brass)' }}>{r.stars.toLocaleString()} stars</span>
                        )}
                        {r.language && (
                          <span className="tag tag-accent">{r.language}</span>
                        )}
                        {r.downloads != null && (
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{r.downloads.toLocaleString()} dl</span>
                        )}
                      </div>
                    </div>
                    <span style={{ color: 'var(--brass)', marginTop: 2 }}><IcoExt size={11} /></span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function InlineArchDiagram({ archData, onExpand }) {
  const nodes = archData?.nodes || []
  const edges = archData?.edges || []
  if (!nodes.length) return null

  return (
    <div style={{
      marginTop: 10, background: 'var(--ink)', borderRadius: 8,
      border: '1px solid var(--brass-line)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 12px', background: 'var(--brass-dim)',
        borderBottom: '1px solid var(--rule)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--paper-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <IcoNodes size={12} /> {archData.title}
        </span>
        <button onClick={onExpand} className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 11, gap: 4 }}>
          <IcoNodes size={11} /> Open in Studio ↗
        </button>
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {nodes.map((n, i) => {
          const c = TYPE_COLORS[n.type] || TYPE_COLORS.default
          return (
            <div key={n.id} style={{
              padding: '4px 9px', borderRadius: 3, fontSize: 10, fontWeight: 600,
              background: c.bg, border: `1px solid ${c.border}`, color: c.text,
              letterSpacing: '0.02em',
            }}>
              {i + 1}. {n.label}
            </div>
          )
        })}
      </div>

      <div style={{ padding: '4px 12px 8px', fontSize: 10, color: 'var(--faint)' }}>
        {nodes.length} nodes · {edges.length} connections
      </div>
    </div>
  )
}

function ClarifyBubble({ question, onAnswer }) {
  const CHIPS = [
    'Tell me about the uploaded paper',
    'Find related papers on ArXiv',
    'Show the system architecture',
    'Find code implementations',
    'Search for relevant datasets',
  ]

  return (
    <div style={{ maxWidth: '82%' }}>
      <div style={{
        padding: '11px 14px',
        background: 'var(--brass-dim)',
        border: '1px solid var(--brass-line)',
        borderRadius: '2px 10px 10px 10px',
        fontSize: 13, lineHeight: 1.7, color: 'var(--paper)',
        marginBottom: 8,
      }}>
        {question}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {CHIPS.map(chip => (
          <button
            key={chip}
            onClick={() => onAnswer(chip)}
            className="btn btn-ghost"
            style={{ height: 26, fontSize: 11, padding: '0 10px' }}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}

function RagModeBadge({ ragMode }) {
  if (!ragMode) return null
  const isVectorless = ragMode === 'vectorless'
  return (
    <span className="tag" style={{
      marginLeft: 4,
      background: isVectorless ? 'rgba(197,123,90,0.15)' : 'rgba(138,163,122,0.15)',
      color: isVectorless ? '#c57b5a' : '#8aa37a',
      border: `1px solid ${isVectorless ? 'rgba(197,123,90,0.3)' : 'rgba(138,163,122,0.3)'}`,
    }}>
      {isVectorless ? '⚡ Vectorless' : '⬡ Vector'}
    </span>
  )
}

function IntentBadge({ intent, ragMode }) {
  const INTENT_META = {
    rag:          { label: 'Paper Q&A' },
    mcp:          { label: 'Web search' },
    hybrid:       { label: 'Paper + web' },
    architecture: { label: 'Architecture' },
  }
  const meta = INTENT_META[intent]
  return (
    <>
      {meta && <span className="tag tag-accent" style={{ marginLeft: 8 }}>{meta.label}</span>}
      <RagModeBadge ragMode={ragMode} />
    </>
  )
}

function MessageBubble({ msg, index, onExpand, onAnswer }) {
  const isUser = msg.role === 'user'
  const [sourcesExpanded, setSourcesExpanded] = useState(false)
  const meta = msg.meta || {}

  if (meta.intent === 'clarify') {
    return (
      <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, animationDelay: `${Math.min(index * 0.04, 0.3)}s` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <RoleAvatar role="assistant" />
          <span style={{ fontSize: 10, color: 'var(--faint)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Assistant</span>
        </div>
        <ClarifyBubble question={meta.clarify_question} onAnswer={onAnswer} />
      </div>
    )
  }

  return (
    <div
      className="animate-fade"
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        animationDelay: `${Math.min(index * 0.04, 0.3)}s`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexDirection: isUser ? 'row-reverse' : 'row' }}>
        <RoleAvatar role={isUser ? 'user' : 'assistant'} />
        <span style={{ fontSize: 10, color: 'var(--faint)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {isUser ? 'You' : 'Assistant'}
        </span>
        {!isUser && meta.intent && <IntentBadge intent={meta.intent} ragMode={meta.rag_mode} />}
      </div>

      {(msg.content || meta.isError) && (
        <div style={{
          maxWidth: '82%',
          padding: '11px 14px',
          borderRadius: isUser ? '10px 2px 10px 10px' : '2px 10px 10px 10px',
          background: isUser
            ? 'linear-gradient(180deg, #d8c39a, var(--brass))'
            : meta.isError
              ? 'var(--rust-dim)'
              : 'var(--panel)',
          border: isUser ? '1px solid #9a7d4c' : `1px solid ${meta.isError ? 'rgba(197,123,90,0.35)' : 'var(--rule)'}`,
          color: isUser ? 'var(--brass-ink)' : 'var(--paper)',
          fontSize: 13, lineHeight: 1.7,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          boxShadow: isUser ? 'var(--shadow-btn)' : 'none',
        }}>
          {msg.content}
        </div>
      )}

      {!isUser && meta.arch_data && (
        <div style={{ maxWidth: '82%', width: '100%' }}>
          <InlineArchDiagram archData={meta.arch_data} onExpand={() => onExpand(meta.arch_data)} />
        </div>
      )}

      {!isUser && meta.tool_calls?.length > 0 && (
        <div style={{ maxWidth: '82%', width: '100%' }}>
          <MCPResultCards toolCalls={meta.tool_calls} />
        </div>
      )}

      {!isUser && (meta.sources?.length > 0 || meta.usage) && (
        <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', maxWidth: '82%' }}>
          {meta.sources?.length > 0 && (
            <>
              <button
                onClick={() => setSourcesExpanded(e => !e)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--faint)', padding: 0, fontFamily: 'inherit' }}
              >
                {sourcesExpanded ? '▾' : '▸'} {meta.sources.length} chunks
              </button>
              {sourcesExpanded && meta.sources.map(s => (
                <span key={s.id} className="tag tag-accent" title={s.text}>Chunk {s.id}</span>
              ))}
            </>
          )}
          {meta.usage && (
            <span style={{ fontSize: 10, color: 'var(--faint)', marginLeft: 4, fontFamily: 'var(--mono)' }}>
              {(meta.usage.prompt_tokens + meta.usage.completion_tokens).toLocaleString()} tok
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default function ChatInterface({ sessionId, hasDoc, onOpenArch }) {
  const { messages, addMessage, clear } = useChatHistory()
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [lastQuery, setLastQuery] = useState('')
  const bottomRef   = useRef()
  const textareaRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [input])

  async function submit(queryOverride) {
    const q = (queryOverride || input).trim()
    if (!q || loading) return
    setInput('')
    setLastQuery(q)
    addMessage('user', q)
    setLoading(true)
    try {
      const res = await sendChat(q, sessionId)

      if (res.intent === 'clarify') {
        addMessage('assistant', null, {
          intent: 'clarify',
          clarify_question: res.clarify_question,
        })
      } else {
        addMessage('assistant', res.answer, {
          intent:     res.intent,
          sources:    res.sources,
          tool_calls: res.tool_calls,
          arch_data:  res.arch_data,
          rag_mode:   res.rag_mode,
          usage:      res.usage,
        })
      }
    } catch (err) {
      addMessage('assistant', `Error: ${err.message}`, { isError: true })
    }
    setLoading(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const turnCount = Math.floor(messages.filter(m => m.role === 'user').length)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chat-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--brass)', display: 'flex' }}><IcoBot size={14} /></span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--paper)' }}>Research assistant</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {turnCount > 0 && (
            <span style={{ fontSize: 10, color: 'var(--faint)', fontFamily: 'var(--mono)' }}>{turnCount} turns</span>
          )}
          {messages.length > 0 && (
            <button className="btn btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 11 }} onClick={clear}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="chat-stage">
        {messages.length === 0 && (
          <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 6, margin: '0 auto 16px',
                background: 'linear-gradient(180deg, #d8c39a, var(--brass))',
                color: 'var(--brass-ink)',
                border: '1px solid #9a7d4c',
                boxShadow: 'var(--shadow-btn)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IcoPaper size={20} stroke={1.6} />
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, color: 'var(--paper)', marginBottom: 8, letterSpacing: '-0.02em' }}>
                {hasDoc ? 'Ready to read' : 'Open a paper to begin'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 380, lineHeight: 1.6 }}>
                {hasDoc
                  ? 'Ask about the document, search related work, pull implementations, or draw the architecture.'
                  : 'Drop a PDF in the sidebar, or search ArXiv, GitHub, and HuggingFace without one.'}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 540 }}>
              <div className="side-label" style={{ textAlign: 'center', marginBottom: 2 }}>Try asking</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {STARTERS.map((s, i) => {
                  const IconCmp = s.icon
                  const needsDoc = s.text.startsWith('What is the main contribution') || s.text.startsWith('How would I implement') || s.text.startsWith('Show me the system')
                  return (
                    <button
                      key={i}
                      className="starter"
                      onClick={() => submit(s.text)}
                      disabled={!hasDoc && needsDoc}
                    >
                      <span style={{ color: 'var(--brass)', marginTop: 1 }}><IconCmp size={13} /></span>
                      <span>{s.text}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            index={i}
            onExpand={onOpenArch}
            onAnswer={(text) => submit(text)}
          />
        ))}

        {loading && <TypingIndicator query={lastQuery} />}
        <div ref={bottomRef} />
      </div>

      <div className="chat-composer">
        <div className="composer-box">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              hasDoc
                ? 'Ask the paper, search code, or request a diagram…'
                : 'Search ArXiv, GitHub, HuggingFace — or upload a PDF'
            }
            disabled={loading}
            rows={1}
            style={{ flex: 1, resize: 'none', overflow: 'hidden', lineHeight: 1.55, minHeight: 36 }}
          />
          <button
            className="btn btn-primary"
            onClick={() => submit()}
            disabled={loading || !input.trim()}
            style={{ flexShrink: 0 }}
          >
            <IcoSend size={13} />
            Send
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 8, display: 'flex', justifyContent: 'space-between', letterSpacing: '0.04em' }}>
          <span>Enter to send · Shift+Enter for a new line</span>
          <span style={{ fontFamily: 'var(--mono)' }}>Groq · llama-3.3-70b</span>
        </div>
      </div>
    </div>
  )
}
