import { useState } from 'react'

export function useChatHistory() {
  const [messages, setMessages] = useState([])

  const addMessage = (role, content, meta = {}) => {
    const id = crypto.randomUUID()
    setMessages(prev => [...prev, { role, content, meta, id }])
    return id
  }

  // Append streamed text to an existing message (used while an answer streams in)
  const appendToMessage = (id, text) => {
    setMessages(prev => prev.map(m => (
      m.id === id ? { ...m, content: (m.content || '') + text } : m
    )))
  }

  // Merge metadata (and optionally replace content) on an existing message
  const patchMessage = (id, { content, ...metaPatch } = {}) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== id) return m
      return {
        ...m,
        ...(content !== undefined ? { content } : {}),
        meta: { ...m.meta, ...metaPatch },
      }
    }))
  }

  const clear = () => setMessages([])

  return { messages, addMessage, appendToMessage, patchMessage, clear }
}
