import { createContext, useContext, useState } from 'react'

const BDGDContext = createContext(null)

export function BDGDProvider({ children }) {
  const [idImportado, setIdImportado] = useState(null)
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null)
  const [entidadesGeo, setEntidadesGeo] = useState([])
  const [entidadesTab, setEntidadesTab] = useState([])
  const [areaAtuacao, setAreaAtuacao] = useState(null)
  const [bbox, setBbox] = useState(null)
  const [layersAtivos, setLayersAtivos] = useState(['ssdmt', 'ssdbt'])

  const selecionarArquivo = (arquivo) => {
    setIdImportado(arquivo.id_importado)
    setArquivoSelecionado(arquivo)
  }

  const toggleLayer = (sigla) => {
    setLayersAtivos(prev => {
      if (prev.includes(sigla)) {
        return prev.filter(l => l !== sigla)
      } else {
        return [...prev, sigla]
      }
    })
  }

  const value = {
    idImportado,
    arquivoSelecionado,
    entidadesGeo,
    entidadesTab,
    areaAtuacao,
    bbox,
    layersAtivos,
    selecionarArquivo,
    setEntidadesGeo,
    setEntidadesTab,
    setAreaAtuacao,
    setBbox,
    toggleLayer,
    setLayersAtivos
  }

  return (
    <BDGDContext.Provider value={value}>
      {children}
    </BDGDContext.Provider>
  )
}

export function useBDGD() {
  const context = useContext(BDGDContext)
  if (!context) {
    throw new Error('useBDGD deve ser usado dentro de BDGDProvider')
  }
  return context
}
