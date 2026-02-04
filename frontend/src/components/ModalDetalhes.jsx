import { useState, useEffect } from 'react'
import { bdgdApi } from '../services/api'
import './ModalDetalhes.css'

function ModalDetalhes({ tabela, nome, properties, onClose }) {
  const [metadados, setMetadados] = useState({})

  // Carrega metadados da tabela para exibir descrições dos campos
  useEffect(() => {
    const carregarMetadados = async () => {
      try {
        const dados = await bdgdApi.getMetadados(tabela)
        setMetadados(dados)
      } catch (err) {
        console.error('Erro ao carregar metadados:', err)
      }
    }
    if (tabela) {
      carregarMetadados()
    }
  }, [tabela])

  // Filtra propriedades para exibição
  const propriedades = Object.entries(properties || {}).filter(
    ([key]) => key !== 'geom' && key !== 'geometry' && key !== 'id_importado'
  )

  // Formata valor para exibição
  const formatarValor = (valor) => {
    if (valor === null || valor === undefined) return '-'
    if (typeof valor === 'object') return JSON.stringify(valor, null, 2)
    return String(valor)
  }

  // Obtém descrição do campo dos metadados
  const getDescricaoCampo = (campo) => {
    return metadados[campo]?.descricao || ''
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>Detalhes do Registro</h2>
            <span className="modal-tabela">{nome || tabela}</span>
          </div>
          <button className="btn-fechar" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="modal-body">
          {propriedades.length === 0 ? (
            <p className="sem-dados">Nenhum dado disponível</p>
          ) : (
            <dl className="propriedades-lista">
              {propriedades.map(([chave, valor]) => {
                const descricao = getDescricaoCampo(chave)
                return (
                  <div key={chave} className="propriedade-item">
                    <dt title={descricao} className={descricao ? 'com-tooltip' : ''}>
                      {chave}
                      {descricao && <span className="tooltip-indicator">?</span>}
                    </dt>
                    <dd title={formatarValor(valor)}>
                      {formatarValor(valor)}
                    </dd>
                  </div>
                )
              })}
            </dl>
          )}
        </div>

        <footer className="modal-footer">
          <button className="btn-fechar-footer" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </div>
    </div>
  )
}

export default ModalDetalhes
