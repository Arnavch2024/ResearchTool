import React, { useState, useCallback } from 'react'
import ReactFlow, {
  MiniMap, Controls, Background,
  useNodesState, useEdgesState, addEdge,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { generateArchitecture } from '../services/api'

const TYPE_COLORS = {
  input:     { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd' },
  process:   { bg: '#2d1b69', border: '#8b5cf6', text: '#c4b5fd' },
  output:    { bg: '#064e3b', border: '#10b981', text: '#6ee7b7' },
  model:     { bg: '#431407', border: '#f97316', text: '#fdba74' },
  data:      { bg: '#422006', border: '#f59e0b', text: '#fcd34d' },
  attention: { bg: '#450a0a', border: '#ef4444', text: '#fca5a5' },
  default:   { bg: '#1e2235', border: '#2e3250', text: '#e2e8f0' },
}

function makeNode(n) {
  const c = TYPE_COLORS[n.type] || TYPE_COLORS.default
  return {
    id: n.id,
    data: { label: (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: c.text }}>{n.label}</div>
        {n.description && <div style={{ fontSize: 10, color: c.text + 'aa', marginTop: 2 }}>{n.description}</div>}
      </div>
    )},
    position: { x: 0, y: 0 }, // will be auto-laid out
    style: {
      background: c.bg, border: `1.5px solid ${c.border}`,
      borderRadius: 10, padding: '10px 14px',
      minWidth: 120, maxWidth: 180,
    },
  }
}

function makeEdge(e) {
  return {
    id: `${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    label: e.label || '',
    labelStyle: { fill: '#7c8db5', fontSize: 10 },
    style: { stroke: '#2e3250' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#2e3250' },
    animated: true,
  }
}

function autoLayout(nodes, edges) {
  // Simple left-to-right layered layout
  const adj = {}
  const indegree = {}
  nodes.forEach(n => { adj[n.id] = []; indegree[n.id] = 0 })
  edges.forEach(e => { adj[e.source]?.push(e.target); if (indegree[e.target] !== undefined) indegree[e.target]++ })

  // BFS topo sort
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

  // Place any orphan nodes (completely unconnected) in their own final column
  const maxLayer = layer
  nodes.forEach(n => {
    if (!visited.has(n.id)) layers[n.id] = maxLayer
  })

  // Assign positions
  const layerCounts = {}
  Object.values(layers).forEach(l => { layerCounts[l] = (layerCounts[l] || 0) + 1 })
  const layerIdx = {}

  return nodes.map(n => {
    const l = layers[n.id] ?? 0
    const idx = layerIdx[l] ?? 0
    layerIdx[l] = idx + 1
    const count = layerCounts[l] ?? 1
    return { ...n, position: { x: l * 220, y: idx * 120 - ((count - 1) * 60) } }
  })
}

export default function ArchitectureVisualization({ sessionId }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onConnect = useCallback(p => setEdges(e => addEdge(p, e)), [setEdges])

  async function generate() {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const data = await generateArchitecture(prompt, sessionId)
      const rawNodes = (data.nodes || []).map(makeNode)
      const rawEdges = (data.edges || []).map(makeEdge)
      const laidOut = autoLayout(rawNodes, rawEdges)
      setNodes(laidOut)
      setEdges(rawEdges)
      setTitle(data.title || '')
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
          Architecture Visualization {title && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>— {title}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="e.g. Transformer encoder-decoder architecture"
            style={{ flex: 1 }}
            onKeyDown={e => e.key === 'Enter' && generate()} />
          <button className="btn btn-primary" onClick={generate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
        {error && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{error}</div>}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'default').map(([type, c]) => (
            <span key={type} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              background: c.bg, border: `1px solid ${c.border}`, color: c.text
            }}>{type}</span>
          ))}
        </div>
      </div>

      {/* Flow canvas */}
      <div style={{ flex: 1 }}>
        {nodes.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: 13 }}>
            Generate an architecture diagram from your paper or a custom prompt
          </div>
        ) : (
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            style={{ background: 'var(--bg)' }}
          >
            <Controls style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
            <MiniMap style={{ background: 'var(--surface)' }} nodeColor={n => {
              const style = n.style || {}
              return style.border || '#6366f1'
            }} />
            <Background color="#2e3250" gap={20} />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}
