import React, { useState } from 'react'
import {
  searchBenchmarks,
  searchScholar,
  searchArxiv,
  searchGitHub,
  searchHFDatasets,
  searchHFModels,
} from '../services/api'
import {
  IcoTrophy,
  IcoScholar,
  IcoPaper,
  IcoCode,
  IcoBox,
  IcoSearch,
  IcoExt,
} from './Icons'

const SOURCES = [
  {
    key: 'benchmarks',
    label: 'SOTA Benchmarks',
    icon: IcoTrophy,
    color: '#f59e0b',
    fn: searchBenchmarks,
    placeholder: 'Search SOTA leaderboards, benchmarks & trending papers, e.g. "reasoning"',
  },
  {
    key: 'scholar',
    label: 'Semantic Scholar',
    icon: IcoScholar,
    color: 'var(--brass)',
    fn: searchScholar,
    placeholder: 'Search 200M+ papers & citations, e.g. "DeepSeek R1 reasoning"',
  },
  {
    key: 'arxiv',
    label: 'ArXiv',
    icon: IcoPaper,
    color: 'var(--slate)',
    fn: searchArxiv,
    placeholder: 'Search preprints, e.g. "attention is all you need"',
  },
  {
    key: 'github',
    label: 'GitHub',
    icon: IcoCode,
    color: 'var(--brass-2)',
    fn: searchGitHub,
    placeholder: 'Search code repositories, e.g. "flash attention pytorch"',
  },
  {
    key: 'hf_data',
    label: 'HF Datasets',
    icon: IcoBox,
    color: 'var(--moss)',
    fn: searchHFDatasets,
    placeholder: 'Search datasets, e.g. "gsm8k reasoning"',
  },
  {
    key: 'hf_model',
    label: 'HF Models',
    icon: IcoBox,
    color: '#a78bfa',
    fn: searchHFModels,
    placeholder: 'Search model checkpoints, e.g. "llama-3-8b-instruct"',
  },
]

export default function MCPSearch() {
  const [query, setQuery]   = useState('')
  const [active, setActive] = useState('benchmarks')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const src = SOURCES.find(s => s.key === active) || SOURCES[0]

  async function search() {
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
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--brass-dim)', border: '1px solid var(--brass-line)',
            color: 'var(--brass)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IcoSearch size={14} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--paper)' }}>Academic &amp; Ecosystem Explorer</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Live MCP multi-source research intelligence</div>
          </div>
        </div>

        {/* Source tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {SOURCES.map(s => {
            const IconCmp = s.icon
            const isSelected = active === s.key
            return (
              <button
                key={s.key}
                onClick={() => { setActive(s.key); setResults([]); setError('') }}
                style={{
                  flex: 1,
                  padding: '8px 4px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                  background: isSelected ? 'var(--raised)' : 'var(--surface2)',
                  color: isSelected ? s.color : 'var(--muted)',
                  borderBottom: `2px solid ${isSelected ? s.color : 'transparent'}`,
                  transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}
              >
                <IconCmp size={14} />
                <span style={{ fontSize: 10 }}>{s.label}</span>
              </button>
            )
          })}
        </div>

        {/* Search bar */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={src?.placeholder}
            onKeyDown={e => e.key === 'Enter' && search()}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 6,
              background: 'var(--ink)', border: '1px solid var(--rule-2)',
              color: 'var(--paper)', fontSize: 12, outline: 'none',
            }}
          />
          <button className="btn btn-primary" onClick={search} disabled={loading} style={{ flexShrink: 0 }}>
            {loading ? (
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
            ) : (
              <IcoSearch size={13} />
            )}
            Search
          </button>
        </div>

        {error && (
          <div style={{
            marginTop: 8, padding: '8px 12px', borderRadius: 6,
            background: 'var(--rust-dim)', border: '1px solid rgba(197,123,90,0.3)',
            color: 'var(--rust)', fontSize: 11,
          }}>
            {error}
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
            <div style={{
              width: 44, height: 44, borderRadius: 8,
              background: 'var(--panel)', border: '1px solid var(--rule)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: src?.color,
            }}>
              {React.createElement(src?.icon || IcoSearch, { size: 20 })}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--paper-2)' }}>Search {src?.label}</div>
            <div style={{ fontSize: 11, textAlign: 'center', maxWidth: 360, color: 'var(--muted)', lineHeight: 1.5 }}>
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
  const desc  = result.tldr || result.summary || result.description || result.abstract
  const url   = result.url || result.pdf_url
  const shortDesc = typeof desc === 'string' ? desc.slice(0, 200) + (desc.length > 200 ? '…' : '') : ''
  const fullDesc  = typeof desc === 'string' ? desc : ''

  return (
    <div
      className="card animate-fade"
      style={{
        animationDelay: `${index * 0.05}s`,
        background: 'var(--panel)',
        border: '1px solid var(--rule)',
        borderRadius: 8,
        padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <a
          href={url} target="_blank" rel="noreferrer"
          style={{
            color: 'var(--paper)',
            fontWeight: 600, fontSize: 13, textDecoration: 'none',
            lineHeight: 1.4, flex: 1,
          }}
          onMouseEnter={e => e.target.style.color = 'var(--brass)'}
          onMouseLeave={e => e.target.style.color = 'var(--paper)'}
        >
          {title}
        </a>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {result.project_page && (
            <a href={result.project_page} target="_blank" rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 9px', borderRadius: 4,
                background: 'var(--moss-dim)',
                border: '1px solid rgba(138,163,122,0.3)',
                color: 'var(--moss)', fontSize: 10, fontWeight: 600,
                textDecoration: 'none', transition: 'all 0.15s',
              }}
            >
              <IcoCode size={10} />
              <span>Code</span>
            </a>
          )}
          {url && (
            <a href={url} target="_blank" rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 9px', borderRadius: 4,
                background: 'var(--brass-dim)',
                border: '1px solid var(--brass-line)',
                color: 'var(--brass-2)', fontSize: 10, fontWeight: 600,
                textDecoration: 'none', transition: 'all 0.15s',
              }}
            >
              <span>Open</span>
              <IcoExt size={10} />
            </a>
          )}
        </div>
      </div>

      {fullDesc && (
        <div style={{ color: 'var(--paper-2)', fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}>
          {expanded ? fullDesc : shortDesc}
          {fullDesc.length > 200 && (
            <button onClick={() => setExpanded(e => !e)} style={{
              background: 'none', border: 'none', color: 'var(--brass)',
              cursor: 'pointer', fontSize: 11, padding: '0 4px', fontFamily: 'inherit',
            }}>
              {expanded ? ' show less' : ' more'}
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {result.upvotes != null && (
          <span className="tag" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', fontWeight: 600 }}>
            👍 {result.upvotes.toLocaleString()} upvotes
          </span>
        )}
        {result.citations != null && (
          <span className="tag" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)', fontWeight: 600 }}>
            {result.citations.toLocaleString()} citations
          </span>
        )}
        {result.org && (
          <span className="tag tag-accent">{result.org}</span>
        )}
        {result.venue && (
          <span className="tag" style={{ background: 'var(--surface2)', color: 'var(--paper-2)' }}>
            {result.venue}
          </span>
        )}
        {result.year && (
          <span className="tag tag-accent">{result.year}</span>
        )}
        {result.published && (
          <span className="tag tag-accent">{result.published}</span>
        )}
        {result.authors?.length > 0 && (
          <span className="tag" style={{ background: 'var(--surface3)', color: 'var(--muted)' }}>
            {result.authors.slice(0, 3).join(', ')}{result.authors.length > 3 ? ` +${result.authors.length - 3}` : ''}
          </span>
        )}
        {source === 'github' && result.language && (
          <span className="tag" style={{ background: 'var(--moss-dim)', color: 'var(--moss)' }}>{result.language}</span>
        )}
        {source === 'github' && result.stars != null && (
          <span className="tag tag-accent">⭐ {result.stars.toLocaleString()}</span>
        )}
        {(source === 'hf_data' || source === 'hf_model') && (
          <span className="tag" style={{ background: 'var(--surface2)', color: '#c084fc' }}>
            ↓ {result.downloads?.toLocaleString() ?? '?'} dl
          </span>
        )}
      </div>
    </div>
  )
}
