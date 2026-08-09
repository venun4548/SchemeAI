import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, setToken, getToken } from '../lib/api'

const AuthContext = createContext(null)

const ROLE_MAP = {
  super_admin: 'SUPER_ADMIN',
  operations_admin: 'OPERATIONS_ADMIN',
  scheme_admin: 'SCHEME_ADMIN',
  content_reviewer: 'CONTENT_REVIEWER',
  support_agent: 'SUPPORT_AGENT',
  ai_operations: 'AI_OPERATIONS',
  analyst: 'ANALYST',
}

function normalizeUser(u) {
  if (!u) return u
  if (u.role === 'admin') {
    return { ...u, role: ROLE_MAP[u.admin_role] || 'ADMIN' }
  }
  return { ...u, role: 'CITIZEN' }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (!getToken()) {
        setLoading(false)
        return
      }
      try {
        const me = await api.get('/auth/me')
        if (!cancelled) setUser(normalizeUser(me))
      } catch {
        setToken(null)
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    setToken(res.access_token)
    const u = normalizeUser(res.user)
    setUser(u)
    return u
  }, [])

  const register = useCallback(async (payload) => {
    const res = await api.post('/auth/register', payload)
    setToken(res.access_token)
    const u = normalizeUser(res.user)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const me = await api.get('/auth/me')
      const u = normalizeUser(me)
      setUser(u)
      return u
    } catch {
      logout()
      return null
    }
  }, [logout])

  const value = useMemo(
    () => ({ user, setUser, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
