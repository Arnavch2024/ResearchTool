const BASE = '/api'

export async function uploadPDF(file, sessionId) {
  const form = new FormData()
  form.append('file', file)
  form.append('session_id', sessionId)
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
  if (!res.ok) throw new Error((await res.json()).error)
  return res.json()
}

export async function sendChat(query, sessionId) {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, session_id: sessionId }),
  })
  if (!res.ok) throw new Error((await res.json()).error)
  return res.json()
}

export async function clearSession(sessionId) {
  await fetch(`${BASE}/clear/${sessionId}`, { method: 'DELETE' })
}

export async function searchArxiv(query, n = 5) {
  const res = await fetch(`${BASE}/mcp/arxiv?q=${encodeURIComponent(query)}&n=${n}`)
  return (await res.json()).results
}

export async function searchGitHub(query, n = 5) {
  const res = await fetch(`${BASE}/mcp/github?q=${encodeURIComponent(query)}&n=${n}`)
  return (await res.json()).results
}

export async function searchHFDatasets(query, n = 5) {
  const res = await fetch(`${BASE}/mcp/huggingface/datasets?q=${encodeURIComponent(query)}&n=${n}`)
  return (await res.json()).results
}

export async function searchHFModels(query, n = 5) {
  const res = await fetch(`${BASE}/mcp/huggingface/models?q=${encodeURIComponent(query)}&n=${n}`)
  return (await res.json()).results
}

export async function generateArchitecture(prompt, sessionId) {
  const res = await fetch(`${BASE}/architecture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, session_id: sessionId }),
  })
  if (!res.ok) throw new Error((await res.json()).error)
  return res.json()
}

export async function generatePrototype(description, sessionId) {
  const res = await fetch(`${BASE}/prototype`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, session_id: sessionId }),
  })
  if (!res.ok) throw new Error((await res.json()).error)
  return res.json()
}
