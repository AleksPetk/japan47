/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, jsonBody, tokenStore } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(tokenStore.get()?.access))

  const loadUser = useCallback(async () => {
    if (!tokenStore.get()?.access) {
      setLoading(false)
      return null
    }
    try {
      const profile = await api('/profile/')
      setUser(profile)
      return profile
    } catch {
      tokenStore.clear()
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  const login = async (username, password) => {
    const tokens = await api('/auth/login/', {
      method: 'POST',
      body: jsonBody({ username, password }),
    })
    tokenStore.set(tokens)
    return loadUser()
  }
  const register = async (values) => {
    return api('/auth/register/', { method: 'POST', body: jsonBody(values) })
  }
  const logout = async () => {
    const refresh = tokenStore.get()?.refresh
    try {
      if (refresh) await api('/auth/logout/', { method: 'POST', body: jsonBody({ refresh }) })
    } finally {
      tokenStore.clear()
      setUser(null)
    }
  }

  const clearAuth = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    setLoading(false)
  }, [])

  const value = { user, loading, login, register, logout, clearAuth, reloadUser: loadUser }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
