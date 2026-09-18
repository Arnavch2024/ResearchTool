const BASE = '/api'

export async function uploadPDF(file, sessionId) {
  const form = new FormData()
  form.append('file', file)
  form.append('session_id', sessionId)
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
  if (!res.ok) throw new Error((await res.json()).error)
  return res.json()
}

/**
 * Send a chat message. The backend now auto-routes to RAG / MCP / arch / clarify.
 * Response shape:
 *   {intent, answer, sources, tool_calls, arch_data, usage, clarify_question?}
 */
export async function sendChat(query, sessionId) {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, session_id: sessionId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

export async function clearSession(sessionId) {
  await fetch(`${BASE}/clear/${sessionId}`, { method: 'DELETE' })
}
