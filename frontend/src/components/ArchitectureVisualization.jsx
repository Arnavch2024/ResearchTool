import React, { useState, useCallback, useEffect } from 'react'
import ReactFlow, {
  MiniMap, Controls, Background,
  useNodesState, useEdgesState, addEdge,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { IcoNodes, IcoClose, IcoSearch, IcoBox } from './Icons'

const TYPE_COLORS = {
  input:     { bg: '#1a2430', border: '#6d8498', text: '#c5d4e0', label: 'Input' },
  process:   { bg: '#242018', border: '#c4a36a', text: '#e6d4b0', label: 'Process' },
  output:    { bg: '#1a2418', border: '#8aa37a', text: '#cfe0c4', label: 'Output' },
  model:     { bg: '#2a1e18', border: '#c57b5a', text: '#efc4b0', label: 'Model' },
  data:      { bg: '#241f14', border: '#b89a5e', text: '#e8d7a8', label: 'Data/Embedding' },
  attention: { bg: '#2a1816', border: '#c57b5a', text: '#efc4b0', label: 'Attention/Layer' },
  default:   { bg: '#1e1c18', border: '#3a372f', text: '#ece6d6', label: 'Component' },
}

const PRESET_PROMPTS = [
  'Full system overview & pipeline',
  'Multi-head attention & feed-forward layers',
  'Data preprocessing & embedding pipeline',
  'Loss optimization & training flow',
  'RAG retrieval & reranking architecture',
]

function makeNode(n, isSelected = false) {
  const c = TYPE_COLORS[n.type] || TYPE_COLORS.default
  return {
    id: n.id,
    data: {
      raw: n,
      label: (
        <div style={{ textAlign: 'center', userSelect: 'none' }}>
          <div style={{
            display: 'inline-block',
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: c.border,
            marginBottom: 3,
            fontWeight: 700,
          }}>
            {c.label}
          </div>
          <div style={{ fontWeight: 700, fontSize: 11, color: c.text, letterSpacing: '0.01em', lineHeight: 1.3 }}>
            {n.label}
          </div>
          {n.description && (
            <div style={{ fontSize: 9, color: c.text + 'aa', marginTop: 4, lineHeight: 1.35, maxHeight: 36, overflow: 'hidden' }}>
              {n.description}
            </div>
          )}
        </div>
      )
    },
    position: { x: 0, y: 0 },
    style: {
      background: c.bg,
      border: isSelected ? `2px solid #fff` : `1.5px solid ${c.border}`,
      borderRadius: 10,
      padding: '10px 14px',
      minWidth: 130,
      maxWidth: 185,
      boxShadow: isSelected ? '0 0 16px rgba(196,163,106,0.5)' : '0 8px 20px rgba(0,0,0,0.35)',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    },
  }
}

function makeEdge(e) {
  return {
    id: `${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    label: e.label || '',
    labelStyle: { fill: '#9c9483', fontSize: 9, fontWeight: 600 },
    labelBgStyle: { fill: '#191713', fillOpacity: 0.9 },
    labelBgPadding: [4, 2],
    labelBgBorderRadius: 4,
    style: { stroke: '#4a4436', strokeWidth: 1.6 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#8a8273', width: 14, height: 14 },
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
    return { ...n, position: { x: l * 240 + 40, y: idx * 140 - ((count - 1) * 70) + 180 } }
  })
}

export default function ArchitectureVisualization({
  sessionId,
  hasDoc = false,
  docInfo = null,
  sharedArchData = null,
  onUpdateArchData = null,
  preloadedData = null,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [prompt, setPrompt] = useState('')
  const [title, setTitle]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [selectedNode, setSelectedNode] = useState(null)
  const [rawGraphData, setRawGraphData] = useState(null)

  // Load either preloadedData or sharedArchData
  const activeSource = preloadedData || sharedArchData

  useEffect(() => {
    if (!activeSource) return
    loadGraph(activeSource)
  }, [activeSource])

  function loadGraph(data) {
    if (!data) return
    setRawGraphData(data)
    setTitle(data.title || 'Architecture Diagram')
    const rawNodes = (data.nodes || []).map(n => makeNode(n))
    const rawEdges = (data.edges || []).map(makeEdge)
    const laidOut  = autoLayout(rawNodes, rawEdges)
    setNodes(laidOut)
    setEdges(rawEdges)
    setSelectedNode(null)
  }

  const onConnect = useCallback(p => setEdges(e => addEdge(p, e)), [setEdges])

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node.data?.raw || null)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  async function generate(overridePrompt = null) {
    const targetPrompt = overridePrompt !== null ? overridePrompt : prompt
    if (loading) return
    setLoading(true)
    setError('')
    setSelectedNode(null)
    try {
      const res = await fetch('/api/architecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: targetPrompt, session_id: sessionId }),
      })
      if (!res.ok) throw new Error('Architecture generation failed')
      const data = await res.json()
      loadGraph(data)
      if (onUpdateArchData) {
        onUpdateArchData(data)
      }
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
    a.download = `${(title || 'architecture').toLowerCase().replace(/\s+/g, '_')}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadJSON() {
    if (!rawGraphData) return
    const blob = new Blob([JSON.stringify(rawGraphData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(title || 'architecture').toLowerCase().replace(/\s+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function triggerRelayout() {
    if (!nodes.length) return
    const laidOut = autoLayout(nodes, edges)
    setNodes(laidOut)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--ink)', position: 'relative' }}>

      {/* ── Studio Header & Control Bar ── */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--rule)',
        background: 'var(--ink-2)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="cap-ico" style={{ width: 30, height: 30, background: 'var(--brass-dim)', color: 'var(--brass)' }}>
              <IcoNodes size={15} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 16, color: 'var(--paper)' }}>
                  Architecture Studio
                </span>
                {title && (
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
                    / {title}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: 'var(--faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Context-grounded interactive diagram generator
              </div>
            </div>
          </div>

          {/* Paper Context Status Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {hasDoc && docInfo ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 6,
                background: 'var(--panel-2)', border: '1px solid var(--rule-2)',
                fontSize: 11,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--moss)' }} />
                <span style={{ color: 'var(--paper-2)', fontWeight: 500 }}>
                  Active Paper ({docInfo.num_pages}p)
                </span>
                <span className="tag" style={{
                  fontSize: 10, padding: '1px 6px',
                  background: docInfo.rag_mode === 'vectorless' ? 'rgba(197,123,90,0.15)' : 'rgba(138,163,122,0.15)',
                  color: docInfo.rag_mode === 'vectorless' ? '#c57b5a' : '#8aa37a',
                }}>
                  {docInfo.rag_mode === 'vectorless' ? '⚡ Vectorless' : '⬡ Vector'}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                No paper indexed — generating in general AI/ML mode
              </span>
            )}
          </div>
        </div>

        {/* Input Bar & Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
            <input
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={hasDoc ? "Describe component (or leave empty to auto-extract paper architecture)..." : "e.g., Transformer encoder-decoder, RAG pipeline, MoE routing..."}
              onKeyDown={e => e.key === 'Enter' && generate()}
              style={{ paddingRight: 30 }}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={() => generate()}
            disabled={loading}
            style={{ flexShrink: 0, height: 34 }}
          >
            {loading ? (
              <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            )}
            {loading ? 'Synthesizing…' : (hasDoc && !prompt.trim() ? '⚡ Auto-Extract from Paper' : 'Generate Diagram')}
          </button>

          {nodes.length > 0 && (
            <>
              <button className="btn btn-ghost" onClick={triggerRelayout} style={{ height: 34 }} title="Re-calculate auto layout">
                🔄 Re-layout
              </button>
              <button className="btn btn-ghost" onClick={downloadSVG} style={{ height: 34 }} title="Export as SVG vector image">
                💾 SVG
              </button>
              <button className="btn btn-ghost" onClick={downloadJSON} style={{ height: 34 }} title="Export raw graph JSON">
                📥 JSON
              </button>
            </>
          )}
        </div>

        {/* Preset Prompt Chips */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--faint)', alignSelf: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 2 }}>
            Presets:
          </span>
          {PRESET_PROMPTS.map(preset => (
            <button
              key={preset}
              onClick={() => { setPrompt(preset); generate(preset) }}
              disabled={loading}
              style={{
                fontSize: 10, padding: '3px 9px', borderRadius: 4,
                background: 'var(--panel)', border: '1px solid var(--rule)',
                color: 'var(--paper-2)', cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brass)'; e.currentTarget.style.color = 'var(--paper)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--rule)'; e.currentTarget.style.color = 'var(--paper-2)' }}
            >
              {preset}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ marginTop: 10, padding: '7px 12px', borderRadius: 6, background: 'var(--rust-dim)', color: 'var(--rust)', border: '1px solid var(--rust)', fontSize: 12 }}>
            ⚠ {error}
          </div>
        )}
      </div>

      {/* ── Main Canvas & Inspector ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
        <div style={{ flex: 1, position: 'relative', height: '100%' }}>
          {nodes.length === 0 ? (
            <div className="animate-fade" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: '100%', gap: 14, color: 'var(--muted)', padding: 20,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'var(--brass-dim)', border: '1px solid var(--brass-line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brass)',
              }}>
                <IcoNodes size={26} />
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--paper)', textAlign: 'center' }}>
                Architecture &amp; System Flow Studio
              </div>
              <div style={{ fontSize: 12, maxWidth: 440, textAlign: 'center', lineHeight: 1.6, color: 'var(--paper-2)' }}>
                {hasDoc ? (
                  <>Your paper is indexed in <strong>{docInfo?.rag_mode === 'vectorless' ? '⚡ Vectorless PageTree' : '⬡ Vector Hybrid'}</strong> mode. Click <strong>"⚡ Auto-Extract from Paper"</strong> to extract the end-to-end model pipeline, or pick a preset above.</>
                ) : (
                  <>Upload a research paper in the left sidebar to generate grounded architecture diagrams, or enter any system flow description above.</>
                )}
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              fitView
              fitViewOptions={{ padding: 0.25 }}
              style={{ background: 'var(--ink)' }}
            >
              <Controls style={{
                background: 'var(--panel)', border: '1px solid var(--rule)',
                borderRadius: 6, overflow: 'hidden',
              }} />
              <MiniMap
                style={{ background: 'var(--panel)', border: '1px solid var(--rule)', borderRadius: 6 }}
                nodeColor={n => {
                  const type = n.data?.raw?.type || 'default'
                  return TYPE_COLORS[type]?.border || '#c4a36a'
                }}
                maskColor="rgba(18,17,14,0.78)"
              />
              <Background color="#2a271f" gap={22} size={1} />
            </ReactFlow>
          )}

          {/* Bottom Type Legend Bar */}
          {nodes.length > 0 && (
            <div style={{
              position: 'absolute', bottom: 12, left: 14,
              display: 'flex', gap: 6, flexWrap: 'wrap',
              background: 'rgba(25,23,19,0.85)', backdropFilter: 'blur(8px)',
              padding: '6px 10px', borderRadius: 8, border: '1px solid var(--rule)',
              zIndex: 10,
            }}>
              {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'default').map(([type, c]) => (
                <span key={type} style={{
                  fontSize: 9, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                  background: c.bg, border: `1px solid ${c.border}`, color: c.text,
                }}>
                  {c.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Node Inspector Drawer ── */}
        {selectedNode && (
          <aside className="animate-fade" style={{
            width: 280,
            borderLeft: '1px solid var(--rule)',
            background: 'var(--ink-2)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: 16,
            zIndex: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', fontWeight: 700 }}>
                Node Inspector
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 2 }}
              >
                <IcoClose size={13} />
              </button>
            </div>

            <div style={{
              padding: '12px',
              borderRadius: 8,
              background: (TYPE_COLORS[selectedNode.type] || TYPE_COLORS.default).bg,
              border: `1px solid ${(TYPE_COLORS[selectedNode.type] || TYPE_COLORS.default).border}`,
              marginBottom: 14,
            }}>
              <span style={{
                fontSize: 9, textTransform: 'uppercase', fontWeight: 700,
                color: (TYPE_COLORS[selectedNode.type] || TYPE_COLORS.default).border,
              }}>
                {(TYPE_COLORS[selectedNode.type] || TYPE_COLORS.default).label}
              </span>
              <div style={{
                fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600,
                color: (TYPE_COLORS[selectedNode.type] || TYPE_COLORS.default).text,
                marginTop: 4,
              }}>
                {selectedNode.label}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--paper-2)', marginBottom: 4 }}>
                Description &amp; Role
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--muted)' }}>
                {selectedNode.description || 'Core processing element within this architecture flow.'}
              </div>
            </div>

            {/* Inbound & Outbound Connections */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--paper-2)', marginBottom: 6 }}>
                Connected Pathways
              </div>
              {(() => {
                const inbound = edges.filter(e => e.target === selectedNode.id)
                const outbound = edges.filter(e => e.source === selectedNode.id)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                    <div>
                      <span style={{ color: 'var(--faint)' }}>Inputs ({inbound.length}):</span>{' '}
                      <span style={{ color: 'var(--paper-2)' }}>
                        {inbound.map(e => e.source).join(', ') || 'None (Initial Entry)'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--faint)' }}>Outputs ({outbound.length}):</span>{' '}
                      <span style={{ color: 'var(--paper-2)' }}>
                        {outbound.map(e => e.target).join(', ') || 'None (Terminal)'}
                      </span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
