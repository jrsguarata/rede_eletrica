import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBDGD } from '../context/BDGDContext'
import { bdgdApi } from '../services/api'
import PainelLayers from '../components/PainelLayers'
import PainelTabelas from '../components/PainelTabelas'
import TabelaPaginada from '../components/TabelaPaginada'
import ModalDetalhes from '../components/ModalDetalhes'
import './ConsultaTabular.css'

function ConsultaTabular() {
  const { tabela } = useParams()
  const navigate = useNavigate()
  const { idImportado, arquivoSelecionado, entidadesTab, entidadesGeo } = useBDGD()

  const [dados, setDados] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [registroSelecionado, setRegistroSelecionado] = useState(null)
  const [modalAberto, setModalAberto] = useState(false)

  // Encontra informações da tabela
  const infoTabela = [...entidadesTab, ...entidadesGeo].find(
    e => e.sigla === tabela
  )

  useEffect(() => {
    if (!idImportado) {
      navigate('/')
      return
    }
    carregarDados()
  }, [idImportado, tabela])

  const carregarDados = async () => {
    try {
      setLoading(true)
      setError(null)
      const resultado = await bdgdApi.getDadosTabulares(tabela, idImportado)
      setDados(resultado.registros)
      setTotal(resultado.total)
    } catch (err) {
      setError('Erro ao carregar dados da tabela')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleVerDetalhes = (registro) => {
    setRegistroSelecionado(registro)
    setModalAberto(true)
  }

  const handleVoltarMapa = () => {
    navigate('/mapa')
  }

  if (!idImportado) {
    return null
  }

  return (
    <div className="consulta-container">
      <header className="consulta-header">
        <button className="btn-voltar" onClick={handleVoltarMapa}>
          ← Voltar
        </button>
        <h1>{arquivoSelecionado?.nome || 'BDGD'}</h1>
      </header>

      <div className="consulta-content">
        <aside className="painel-lateral">
          <PainelLayers entidades={entidadesGeo} />
          <PainelTabelas entidades={entidadesTab} />
        </aside>

        <main className="tabela-wrapper">
          <div className="tabela-header">
            <h2>{infoTabela?.nome || tabela}</h2>
            <span className="total-registros">{total} registros</span>
          </div>

          <div className="tabela-content">
            {loading ? (
              <div className="loading">Carregando dados...</div>
            ) : error ? (
              <div className="error">{error}</div>
            ) : dados.length === 0 ? (
              <div className="sem-dados">Nenhum registro encontrado.</div>
            ) : (
              <TabelaPaginada
                dados={dados}
                onVerDetalhes={handleVerDetalhes}
              />
            )}
          </div>
        </main>
      </div>

      {modalAberto && registroSelecionado && (
        <ModalDetalhes
          tabela={tabela}
          nome={infoTabela?.nome || tabela}
          properties={registroSelecionado}
          onClose={() => setModalAberto(false)}
        />
      )}
    </div>
  )
}

export default ConsultaTabular
