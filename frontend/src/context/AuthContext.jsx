import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)      // null=verificando, false=não autenticado, object=autenticado
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Verifica sessão existente (cookie) ao montar
  // Se há sso_token na URL, pula verificação (SSOHandler vai tratar)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('sso_token')) {
      setLoading(false)
    } else {
      checkSession()
    }
  }, [])

  const checkSession = async () => {
    try {
      const response = await api.get('/api/auth/me')
      setUser(response.data.user)
    } catch (err) {
      setUser(false)
    } finally {
      setLoading(false)
    }
  }

  const loginWithSSOToken = async (ssoToken, returnUrl = '') => {
    try {
      setError(null)
      const response = await api.post('/api/auth/sso', { sso_token: ssoToken, return_url: returnUrl })
      setUser(response.data.user)
      return true
    } catch (err) {
      const msg = err.response?.data?.detail || 'Erro ao validar token SSO'
      setError(msg)
      setUser(false)
      return false
    }
  }

  const logout = async () => {
    const returnUrl = user?.returnUrl
    try {
      await api.post('/api/auth/logout')
    } catch (err) {
      // ignora erro de logout
    }
    setUser(false)
    if (returnUrl) {
      window.location.href = returnUrl
    }
  }

  const value = {
    user,
    loading,
    error,
    loginWithSSOToken,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}
