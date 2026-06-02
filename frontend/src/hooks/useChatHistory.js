import { useState } from 'react'

export function useChatHistory() {
  const [messages, setMessages] = useState([])

  const addMessage = (role, content, meta = {}) => {
    setMessages(prev => [...prev, { role, content, meta, id: crypto.randomUUID() }])
  }

  const clear = () => setMessages([])

  return { messages, addMessage, clear }
}
