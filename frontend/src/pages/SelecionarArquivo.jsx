import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBDGD } from '../context/BDGDContext'
import { bdgdApi } from '../services/api'
import './SelecionarArquivo.css'

function SelecionarArquivo() {
  const [importados, setImportados] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const { selecionarArquivo } = useBDGD()
  const navigate = useNavigate()

  useEffect(() => {
    carregarImportados()
  }, [])

  const carregarImportados = async () => {
    try {
      setLoading(true)
      const dados = await bdgdApi.getImportados()
      setImportados(dados)
    } catch (err) {
      setError('Erro ao carregar arquivos importados')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelecionar = (arquivo) => {
    selecionarArquivo(arquivo)
    navigate('/mapa')
  }

  if (loading) {
    return (
      <div className="selecionar-container">
        <div className="loading">Carregando arquivos importados...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="selecionar-container">
        <div className="error">{error}</div>
      </div>
    )
  }

  return (
    <div className="selecionar-container">
      <header className="selecionar-header">
        <h1>Sistema de Gestão de Rede Elétrica - BDGD</h1>
        <p>Selecione o arquivo BDGD para visualização:</p>
      </header>

      <div className="arquivos-lista">
        {importados.length === 0 ? (
          <div className="sem-arquivos">
            Nenhum arquivo importado encontrado.
          </div>
        ) : (
          importados.map((arquivo) => (
            <div key={arquivo.id_importado} className="arquivo-card">
              <div className="arquivo-info">
                <h3>{arquivo.nome}</h3>
                <p>ID: {arquivo.id_importado}</p>
              </div>
              <button
                className="btn-selecionar"
                onClick={() => handleSelecionar(arquivo)}
              >
                Selecionar
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default SelecionarArquivo
