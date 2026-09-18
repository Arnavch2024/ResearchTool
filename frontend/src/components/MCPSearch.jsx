import React, { useState } from 'react'
import { searchArxiv, searchGitHub, searchHFDatasets, searchHFModels } from '../services/api'

const SOURCES = [
  {
    key: 'arxiv',
    label: 'ArXiv',
    emoji: '📄',
    color: '#ef4444',
    fn: searchArxiv,
    placeholder: 'Search papers, e.g. "attention is all you need"',
  },
  {
    key: 'github',
    label: 'GitHub',
    emoji: '🐙',
    color: '#10b981',
    fn: searchGitHub,
    placeholder: 'Search repos, e.g. "transformer pytorch"',
  },
  {
    key: 'hf_data',
    label: 'HF Datasets',
    emoji: '📦',
    color: '#f59e0b',
    fn: searchHFDatasets,
    placeholder: 'Search datasets, e.g. "squad question answering"',
  },
  {
    key: 'hf_model',
    label: 'HF Models',
    emoji: '🤗',
    color: '#a855f7',
    fn: searchHFModels,
    placeholder: 'Search models, e.g. "bert text classification"',
  },
]

export default function MCPSearch() {
  const [query, setQuery]   = useState('')
  const [active, setActive] = useState('arxiv')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const src = SOURCES.find(s => s.key === active)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    setResults([])
    setError('')
    try {
      const data = await src.fn(query)
      setResults(data || [])
    } catch (e) {
      setError(e.message || 'Search failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          }}>🔍</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Ecosystem Explorer</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>MCP-powered external search</div>
          </div>
        </div>

        {/* Source tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {SOURCES.map(s => (
            <button
              key={s.key}
              onClick={() => { setActive(s.key); setResults([]); setError('') }}
              style={{
                flex: 1,
                padding: '7px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                background: active === s.key ? s.color + '20' : 'var(--surface2)',
                color: active === s.key ? s.color : 'var(--muted)',
                borderBottom: `2px solid ${active === s.key ? s.color : 'transparent'}`,
                transition: 'all 0.18s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}
            >
              <span style={{ fontSize: 14 }}>{s.emoji}</span>
              <span style={{ fontSize: 9 }}>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={src?.placeholder}
            onKeyDown={e => e.key === 'Enter' && search()}
          />
          <button className="btn btn-primary" onClick={search} disabled={loading || !query.trim()} style={{ flexShrink: 0 }}>
            {loading ? (
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            )}
            Search
          </button>
        </div>

        {error && (
          <div style={{
            marginTop: 8, padding: '8px 12px', borderRadius: 8,
            background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.2)',
            color: 'var(--red)', fontSize: 12,
          }}>
            ⚠ {error}
          </div>
        )}
      </div>

      {/* ── Results ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="card" style={{ gap: 8, display: 'flex', flexDirection: 'column' }}>
              <div className="skeleton" style={{ height: 14, width: '70%' }} />
              <div className="skeleton" style={{ height: 10, width: '90%' }} />
              <div className="skeleton" style={{ height: 10, width: '60%' }} />
            </div>
          ))
        )}
        {!loading && results.length === 0 && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--muted)' }}>
            <div style={{ fontSize: 36 }}>{src?.emoji}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)' }}>Search {src?.label}</div>
            <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 300 }}>
              {src?.placeholder}
            </div>
          </div>
        )}
        {!loading && results.map((r, i) => (
          <ResultCard key={i} result={r} source={active} color={src?.color} index={i} />
        ))}
      </div>
    </div>
  )
}

function ResultCard({ result, source, color, index }) {
  const [expanded, setExpanded] = useState(false)

  const title = result.title || result.name || result.id
  const desc  = result.summary || result.description
  const url   = result.url
  const shortDesc = typeof desc === 'string' ? desc.slice(0, 180) + (desc.length > 180 ? '…' : '') : ''
  const fullDesc  = typeof desc === 'string' ? desc : ''

  return (
    <div
      className="card animate-fade"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <a
          href={url} target="_blank" rel="noreferrer"
          style={{
            color: color || 'var(--accent2)',
            fontWeight: 600, fontSize: 13, textDecoration: 'none',
            lineHeight: 1.4, flex: 1,
          }}
          onMouseEnter={e => e.target.style.textDecoration = 'underline'}
          onMouseLeave={e => e.target.style.textDecoration = 'none'}
        >
          {title}
        </a>
        <a href={url} target="_blank" rel="noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 6, flexShrink: 0,
            background: (color || '#6366f1') + '18',
            border: `1px solid ${(color || '#6366f1')}30`,
            color: color || 'var(--accent2)', fontSize: 10, fontWeight: 600,
            textDecoration: 'none', transition: 'all 0.15s',
          }}
        >
          Open ↗
        </a>
      </div>

      {fullDesc && (
        <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}>
          {expanded ? fullDesc : shortDesc}
          {fullDesc.length > 180 && (
            <button onClick={() => setExpanded(e => !e)} style={{
              background: 'none', border: 'none', color: 'var(--accent2)',
              cursor: 'pointer', fontSize: 11, padding: '0 4px', fontFamily: 'inherit',
            }}>
              {expanded ? ' show less' : ' more'}
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
        {source === 'arxiv' && result.published && (
          <span className="tag tag-orange">{result.published}</span>
        )}
        {source === 'arxiv' && result.authors?.length > 0 && (
          <span className="tag" style={{ background: 'var(--surface3)', color: 'var(--text2)' }}>
            {result.authors.slice(0, 2).join(', ')}{result.authors.length > 2 ? ' +' + (result.authors.length - 2) : ''}
          </span>
        )}
        {source === 'github' && result.language && (
          <span className="tag tag-green">{result.language}</span>
        )}
        {source === 'github' && (
          <span className="tag tag-orange">★ {result.stars?.toLocaleString()}</span>
        )}
        {(source === 'hf_data' || source === 'hf_model') && (
          <span className="tag tag-purple">↓ {result.downloads?.toLocaleString() ?? '?'}</span>
        )}
        {result.pipeline_tag && (
          <span className="tag tag-accent">{result.pipeline_tag}</span>
        )}
        {result.tags?.slice(0, 3).map(t => (
          <span key={t} className="tag" style={{ background: 'var(--surface3)', color: 'var(--text2)', fontSize: 10 }}>{t}</span>
        ))}
      </div>
    </div>
  )
}
