import React, { useState, useCallback, useEffect } from 'react'
import ReactFlow, {
  MiniMap, Controls, Background,
  useNodesState, useEdgesState, addEdge,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'

const TYPE_COLORS = {
  input:     { bg: '#1a2430', border: '#6d8498', text: '#c5d4e0' },
  process:   { bg: '#242018', border: '#c4a36a', text: '#e6d4b0' },
  output:    { bg: '#1a2418', border: '#8aa37a', text: '#cfe0c4' },
  model:     { bg: '#2a1e18', border: '#c57b5a', text: '#efc4b0' },
  data:      { bg: '#241f14', border: '#b89a5e', text: '#e8d7a8' },
  attention: { bg: '#2a1816', border: '#c57b5a', text: '#efc4b0' },
  default:   { bg: '#1e1c18', border: '#3a372f', text: '#ece6d6' },
}

function makeNode(n) {
  const c = TYPE_COLORS[n.type] || TYPE_COLORS.default
  return {
    id: n.id,
    data: {
      label: (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: c.text, letterSpacing: '0.01em' }}>
            {n.label}
          </div>
          {n.description && (
            <div style={{ fontSize: 9, color: c.text + '99', marginTop: 3, lineHeight: 1.4 }}>
              {n.description}
            </div>
          )}
        </div>
      )
    },
    position: { x: 0, y: 0 },
    style: {
      background: c.bg,
      border: `1.5px solid ${c.border}`,
      borderRadius: 10,
      padding: '10px 14px',
      minWidth: 120, maxWidth: 175,
      boxShadow: '0 8px 20px rgba(0,0,0,0.28)',
    },
  }
}

function makeEdge(e) {
  return {
    id: `${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    label: e.label || '',
    labelStyle: { fill: '#8a8273', fontSize: 9, fontWeight: 500 },
    labelBgStyle: { fill: '#161512', fillOpacity: 0.85 },
    style: { stroke: '#3a372f', strokeWidth: 1.4 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#5c574c', width: 16, height: 16 },
    animated: true,
  }
}

function autoLayout(nodes, edges) {
  const adj = {}
  const indegree = {}
  nodes.forEach(n => { adj[n.id] = []; indegree[n.id] = 0 })
  edges.forEach(e => {
    adj[e.source]?.push(e.target)
    if (indegree[e.target] !== undefined) indegree[e.target]++
  })

  const queue = nodes.filter(n => indegree[n.id] === 0).map(n => n.id)
  const layers = {}
  const visited = new Set()
  let layer = 0
  let current = [...queue]

  while (current.length) {
    current.forEach(id => { layers[id] = layer; visited.add(id) })
    const next = []
    current.forEach(id => adj[id]?.forEach(t => {
      indegree[t]--
      if (indegree[t] === 0 && !visited.has(t)) next.push(t)
    }))
    current = next
    layer++
  }

  const maxLayer = layer
  nodes.forEach(n => { if (!visited.has(n.id)) layers[n.id] = maxLayer })

  const layerCounts = {}
  Object.values(layers).forEach(l => { layerCounts[l] = (layerCounts[l] || 0) + 1 })
  const layerIdx = {}

  return nodes.map(n => {
    const l = layers[n.id] ?? 0
    const idx = layerIdx[l] ?? 0
    layerIdx[l] = idx + 1
    const count = layerCounts[l] ?? 1
    return { ...n, position: { x: l * 230, y: idx * 130 - ((count - 1) * 65) } }
  })
}

export default function ArchitectureVisualization({ sessionId, preloadedData }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [prompt, setPrompt] = useState('')
  const [title, setTitle]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  // If preloadedData is provided (from chat), load it immediately
  useEffect(() => {
    if (!preloadedData) return
    const rawNodes = (preloadedData.nodes || []).map(makeNode)
    const rawEdges = (preloadedData.edges || []).map(makeEdge)
    const laidOut  = autoLayout(rawNodes, rawEdges)
    setNodes(laidOut)
    setEdges(rawEdges)
    setTitle(preloadedData.title || '')
  }, [preloadedData])

  const onConnect = useCallback(p => setEdges(e => addEdge(p, e)), [setEdges])

  async function generate() {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      // Call the architecture endpoint directly when used standalone
      const res = await fetch('/api/architecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, session_id: sessionId }),
      })
      if (!res.ok) throw new Error('Architecture generation failed')
      const data = await res.json()
      const rawNodes = (data.nodes || []).map(makeNode)
      const rawEdges = (data.edges || []).map(makeEdge)
      const laidOut  = autoLayout(rawNodes, rawEdges)
      setNodes(laidOut)
      setEdges(rawEdges)
      setTitle(data.title || '')
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  function downloadSVG() {
    const svgEl = document.querySelector('.react-flow__renderer svg')
    if (!svgEl) return
    const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'architecture'}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {/* ── Toolbar — hidden when used as modal with preloaded data ── */}
      {!preloadedData && (
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div className="cap-ico">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M10 6.5h4.5V14"/></svg>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 15 }}>
                Architecture
                {title && <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 6 }}>— {title}</span>}
              </div>
              <div style={{ fontSize: 10, color: 'var(--faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Interactive diagram</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. Transformer encoder-decoder architecture, or leave blank to use paper context"
              onKeyDown={e => e.key === 'Enter' && generate()}
            />
            <button className="btn btn-primary" onClick={generate} disabled={loading} style={{ flexShrink: 0 }}>
              {loading ? (
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              )}
              {loading ? 'Generating…' : 'Generate'}
            </button>
            {nodes.length > 0 && (
              <button className="btn btn-ghost" onClick={downloadSVG} style={{ flexShrink: 0 }} title="Download SVG">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                SVG
              </button>
            )}
          </div>

          {error && (
            <div style={{ marginTop: 8, padding: '7px 12px', borderRadius: 8, background: 'var(--red-dim)', color: 'var(--red)', fontSize: 12 }}>
              ⚠ {error}
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'default').map(([type, c]) => (
              <span key={type} style={{
                fontSize: 9, padding: '2px 9px', borderRadius: 99, fontWeight: 600,
                background: c.bg, border: `1px solid ${c.border}`, color: c.text,
              }}>
                {type}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Canvas ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        {nodes.length === 0 ? (
          <div className="animate-fade" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 12, color: 'var(--muted)',
          }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--paper)' }}>No diagram yet</div>
            <div style={{ fontSize: 12, maxWidth: 320, textAlign: 'center' }}>
              Enter a description above or leave it blank to auto-generate from your uploaded paper
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            style={{ background: 'var(--bg)' }}
          >
            <Controls style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, overflow: 'hidden',
            }} />
            <MiniMap
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              nodeColor={n => n.style?.border || '#c4a36a'}
              maskColor="rgba(15,14,12,0.72)"
            />
            <Background color="#2a271f" gap={22} size={1} />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}
