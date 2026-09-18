import React, { createContext, useContext, useState, useEffect } from 'react'
import { apiGetMe, apiLogin, apiRegister, setToken, getToken } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const token = getToken()
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const data = await apiGetMe()
        if (data && data.user) {
          setUser(data.user)
        } else {
          setUser(null)
        }
      } catch (err) {
        console.error('Failed to load user session', err)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [])

  async function login(email, password) {
    const data = await apiLogin(email, password)
    setToken(data.token)
    setUser(data.user)
    return data
  }

  async function register(name, email, password) {
    const data = await apiRegister(name, email, password)
    setToken(data.token)
    setUser(data.user)
    return data
  }

  function logout() {
    setToken(null)
    setUser(null)
  }

  const value = {
    user,
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
