import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { BDGDProvider } from './context/BDGDContext'
import SelecionarArquivo from './pages/SelecionarArquivo'
import MapaPrincipal from './pages/MapaPrincipal'
import ConsultaTabular from './pages/ConsultaTabular'
import NaoAutenticado from './pages/NaoAutenticado'

function SSOHandler({ children }) {
  const { user, loading, error, loginWithSSOToken } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [validating, setValidating] = useState(false)

  useEffect(() => {
    const ssoToken = searchParams.get('sso_token')
    if (ssoToken) {
      setValidating(true)
      // Remove token da URL imediatamente (seguranca)
      searchParams.delete('sso_token')
      setSearchParams(searchParams, { replace: true })
      // Valida token via backend
      loginWithSSOToken(ssoToken).finally(() => setValidating(false))
    }
  }, [])

  if (loading || validating) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666'
      }}>
        Verificando autenticacao...
      </div>
    )
  }

  if (!user) {
    return <NaoAutenticado error={error} />
  }

  return children
}

function App() {
  return (
    <AuthProvider>
      <BDGDProvider>
        <BrowserRouter>
          <SSOHandler>
            <Routes>
              <Route path="/" element={<SelecionarArquivo />} />
              <Route path="/mapa" element={<MapaPrincipal />} />
              <Route path="/tabular/:tabela" element={<ConsultaTabular />} />
            </Routes>
          </SSOHandler>
        </BrowserRouter>
      </BDGDProvider>
    </AuthProvider>
  )
}

export default App
