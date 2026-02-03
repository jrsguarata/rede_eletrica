import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { BDGDProvider } from './context/BDGDContext'
import SelecionarArquivo from './pages/SelecionarArquivo'
import MapaPrincipal from './pages/MapaPrincipal'
import ConsultaTabular from './pages/ConsultaTabular'

function App() {
  return (
    <BDGDProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SelecionarArquivo />} />
          <Route path="/mapa" element={<MapaPrincipal />} />
          <Route path="/tabular/:tabela" element={<ConsultaTabular />} />
        </Routes>
      </BrowserRouter>
    </BDGDProvider>
  )
}

export default App
