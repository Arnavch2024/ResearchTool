import React, { useState } from 'react'
import { searchArxiv, searchGitHub, searchHFDatasets, searchHFModels } from '../services/api'

const SOURCES = [
  { key: 'arxiv', label: 'ArXiv', fn: searchArxiv, color: '#ef4444' },
  { key: 'github', label: 'GitHub', fn: searchGitHub, color: '#10b981' },
  { key: 'hf_data', label: 'HF Datasets', fn: searchHFDatasets, color: '#f59e0b' },
  { key: 'hf_model', label: 'HF Models', fn: searchHFModels, color: '#8b5cf6' },
]

export default function MCPSearch() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState('arxiv')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    setResults([])
    setError('')
    const src = SOURCES.find(s => s.key === active)
    try {
      const data = await src.fn(query)
      setResults(data || [])
    } catch (e) {
      setError(e.message || 'Search failed. Please try again.')
      setResults([])
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>MCP Search Tools</div>

        {/* Source tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {SOURCES.map(s => (
            <button key={s.key} onClick={() => setActive(s.key)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600,
                background: active === s.key ? s.color + '25' : 'var(--surface2)',
                color: active === s.key ? s.color : 'var(--muted)',
                borderBottom: active === s.key ? `2px solid ${s.color}` : '2px solid transparent',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${SOURCES.find(s => s.key === active)?.label}...`}
            style={{ flex: 1 }}
            onKeyDown={e => e.key === 'Enter' && search()} />
          <button className="btn btn-primary" onClick={search} disabled={loading}>
            {loading ? '...' : 'Search'}
          </button>
        </div>
        {error && (
          <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>⚠ {error}</div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {results.length === 0 && !loading && (
          <div style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', marginTop: 30 }}>
            Search for papers, repos, datasets, or models
          </div>
        )}
        {results.map((r, i) => <ResultCard key={i} result={r} source={active} />)}
      </div>
    </div>
  )
}

function ResultCard({ result, source }) {
  const title = result.title || result.name || result.id
  const desc = result.summary || result.description || `Downloads: ${result.downloads?.toLocaleString()}`
  const url = result.url

  return (
    <div style={{ padding: 12, background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <a href={url} target="_blank" rel="noreferrer"
        style={{ color: 'var(--accent)', fontWeight: 500, fontSize: 13, textDecoration: 'none', display: 'block', marginBottom: 4 }}>
        {title}
      </a>
      <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5, marginBottom: 6 }}>
        {typeof desc === 'string' ? desc.slice(0, 200) + (desc.length > 200 ? '...' : '') : ''}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {source === 'arxiv' && result.published && (
          <span className="tag tag-orange">{result.published}</span>
        )}
        {source === 'github' && result.language && (
          <span className="tag tag-green">{result.language}</span>
        )}
        {source === 'github' && (
          <span className="tag tag-orange">★ {result.stars?.toLocaleString()}</span>
        )}
        {result.tags?.slice(0, 3).map(t => (
          <span key={t} className="tag tag-purple">{t}</span>
        ))}
        {result.pipeline_tag && (
          <span className="tag tag-purple">{result.pipeline_tag}</span>
        )}
      </div>
    </div>
  )
}
