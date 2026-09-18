const BASE = '/api'

export function getToken() {
  return localStorage.getItem('rrag_token')
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('rrag_token', token)
  } else {
    localStorage.removeItem('rrag_token')
  }
}

export function getAuthHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiRegister(name, email, password) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Registration failed')
  return data
}

export async function apiLogin(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Login failed')
  return data
}

export async function apiGetMe() {
  const token = getToken()
  if (!token) return null
  const res = await fetch(`${BASE}/auth/me`, {
    headers: { ...getAuthHeaders() },
  })
  if (!res.ok) {
    setToken(null)
    return null
  }
  return res.json()
}

export async function uploadPDF(file, sessionId) {
  const form = new FormData()
  form.append('file', file)
  form.append('session_id', sessionId)
  const res = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: { ...getAuthHeaders() },
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(err.error || 'Upload failed')
  }
  return res.json()
}

/**
 * Send a chat message. Auto-routes to RAG / MCP / arch / clarify.
 */
export async function sendChat(query, sessionId) {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ query, session_id: sessionId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

export async function clearSession(sessionId) {
  await fetch(`${BASE}/clear/${sessionId}`, {
    method: 'DELETE',
    headers: { ...getAuthHeaders() },
  })
}

export async function getChatHistory(sessionId) {
  const res = await fetch(`${BASE}/history/${sessionId}`, {
    headers: { ...getAuthHeaders() },
  })
  if (!res.ok) return []
  return res.json()
}

export async function getSessions() {
  const res = await fetch(`${BASE}/sessions`, {
    headers: { ...getAuthHeaders() },
  })
  if (!res.ok) return []
  return res.json()
}
