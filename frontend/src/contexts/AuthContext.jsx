import React, { createContext, useContext, useState, useEffect } from 'react'
import { apiGetMe, apiLogin, apiRegister, setToken, getToken } from '../services/api'
import { loadUserApiKey, saveUserApiKey, dropUserApiKey } from '../services/keyStore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUserAndKey() {
      const token = getToken()
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const data = await apiGetMe()
        if (data && data.user) {
          setUser(data.user)
          // Load user's persisted API key from IndexedDB
          const key = await loadUserApiKey(data.user.id)
          setApiKey(key || '')
        } else {
          setUser(null)
          setApiKey('')
        }
      } catch (err) {
        console.error('Failed to load user session', err)
        setUser(null)
        setApiKey('')
      } finally {
        setLoading(false)
      }
    }
    loadUserAndKey()
  }, [])

  async function login(email, password) {
    const data = await apiLogin(email, password)
    setToken(data.token)
    setUser(data.user)
    if (data.user?.id) {
      const key = await loadUserApiKey(data.user.id)
      setApiKey(key || '')
    }
    return data
  }

  async function register(name, email, password) {
    const data = await apiRegister(name, email, password)
    setToken(data.token)
    setUser(data.user)
    if (data.user?.id) {
      const key = await loadUserApiKey(data.user.id)
      setApiKey(key || '')
    }
    return data
  }

  async function updateApiKey(newKey) {
    if (!user?.id) return
    await saveUserApiKey(user.id, newKey)
    setApiKey((newKey || '').trim())
  }

  async function logout() {
    if (user?.id) {
      // Explicitly drop user's API key from IndexedDB upon logout
      await dropUserApiKey(user.id)
    }
    setToken(null)
    setUser(null)
    setApiKey('')
  }

  const value = {
    user,
    apiKey,
    hasApiKey: !!apiKey,
    updateApiKey,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
