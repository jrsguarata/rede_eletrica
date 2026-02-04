import { useState, useMemo } from 'react'
import './TabelaPaginada.css'

const ITENS_POR_PAGINA = 10

function TabelaPaginada({ dados, onVerDetalhes, metadados = {} }) {
  const [paginaAtual, setPaginaAtual] = useState(1)

  // Calcula colunas a partir dos dados
  const colunas = useMemo(() => {
    if (dados.length === 0) return []
    return Object.keys(dados[0]).filter(col =>
      col !== 'geom' && col !== 'geometry'
    )
  }, [dados])

  // Obtém descrição do campo dos metadados
  const getDescricaoCampo = (campo) => {
    return metadados[campo]?.descricao || ''
  }

  // Dados da página atual
  const dadosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA
    return dados.slice(inicio, inicio + ITENS_POR_PAGINA)
  }, [dados, paginaAtual])

  const totalPaginas = Math.ceil(dados.length / ITENS_POR_PAGINA)

  const irParaPagina = (pagina) => {
    if (pagina >= 1 && pagina <= totalPaginas) {
      setPaginaAtual(pagina)
    }
  }

  // Gera array de páginas para exibir
  const paginasVisiveis = useMemo(() => {
    const paginas = []
    const maxVisiveis = 5

    let inicio = Math.max(1, paginaAtual - Math.floor(maxVisiveis / 2))
    let fim = Math.min(totalPaginas, inicio + maxVisiveis - 1)

    if (fim - inicio < maxVisiveis - 1) {
      inicio = Math.max(1, fim - maxVisiveis + 1)
    }

    for (let i = inicio; i <= fim; i++) {
      paginas.push(i)
    }

    return paginas
  }, [paginaAtual, totalPaginas])

  // Formata valor para exibição
  const formatarValor = (valor) => {
    if (valor === null || valor === undefined) return '-'
    if (typeof valor === 'object') return JSON.stringify(valor)
    return String(valor)
  }

  return (
    <div className="tabela-paginada">
      <div className="tabela-wrapper">
        <table>
          <thead>
            <tr>
              <th className="col-acao">Ação</th>
              {colunas.slice(0, 6).map((col) => {
                const descricao = getDescricaoCampo(col)
                return (
                  <th
                    key={col}
                    title={descricao}
                    className={descricao ? 'com-tooltip' : ''}
                  >
                    {col}
                    {descricao && <span className="tooltip-indicator">?</span>}
                  </th>
                )
              })}
              {colunas.length > 6 && <th>...</th>}
            </tr>
          </thead>
          <tbody>
            {dadosPaginados.map((registro, index) => (
              <tr key={index}>
                <td className="col-acao">
                  <button
                    className="btn-detalhes"
                    onClick={() => onVerDetalhes(registro)}
                    title="Ver detalhes"
                  >
                    👁️
                  </button>
                </td>
                {colunas.slice(0, 6).map((col) => (
                  <td key={col} title={formatarValor(registro[col])}>
                    {formatarValor(registro[col])}
                  </td>
                ))}
                {colunas.length > 6 && <td>...</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="paginacao">
          <button
            className="btn-pagina"
            onClick={() => irParaPagina(paginaAtual - 1)}
            disabled={paginaAtual === 1}
          >
            ← Anterior
          </button>

          <div className="paginas">
            {paginasVisiveis[0] > 1 && (
              <>
                <button className="btn-pagina" onClick={() => irParaPagina(1)}>
                  1
                </button>
                {paginasVisiveis[0] > 2 && <span>...</span>}
              </>
            )}

            {paginasVisiveis.map((pagina) => (
              <button
                key={pagina}
                className={`btn-pagina ${pagina === paginaAtual ? 'ativo' : ''}`}
                onClick={() => irParaPagina(pagina)}
              >
                {pagina}
              </button>
            ))}

            {paginasVisiveis[paginasVisiveis.length - 1] < totalPaginas && (
              <>
                {paginasVisiveis[paginasVisiveis.length - 1] < totalPaginas - 1 && (
                  <span>...</span>
                )}
                <button
                  className="btn-pagina"
                  onClick={() => irParaPagina(totalPaginas)}
                >
                  {totalPaginas}
                </button>
              </>
            )}
          </div>

          <button
            className="btn-pagina"
            onClick={() => irParaPagina(paginaAtual + 1)}
            disabled={paginaAtual === totalPaginas}
          >
            Próximo →
          </button>
        </div>
      )}

      <div className="info-paginacao">
        Página {paginaAtual} de {totalPaginas} ({dados.length} registros)
      </div>
    </div>
  )
}

export default TabelaPaginada
