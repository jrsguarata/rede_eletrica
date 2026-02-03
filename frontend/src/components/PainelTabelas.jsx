import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './PainelTabelas.css'

function PainelTabelas({ entidades }) {
  const navigate = useNavigate()
  const [expandido, setExpandido] = useState(true)

  const handleClick = (sigla) => {
    navigate(`/tabular/${sigla}`)
  }

  return (
    <div className="painel-tabelas">
      <button className="painel-header" onClick={() => setExpandido(!expandido)}>
        <span className={`painel-seta ${expandido ? 'expandido' : ''}`}>▶</span>
        <h2>Tabelas</h2>
        <span className="painel-contador">{entidades.length}</span>
      </button>
      {expandido && <div className="tabelas-lista">
        {entidades.map((entidade) => (
          <button
            key={entidade.sigla}
            className="tabela-item"
            onClick={() => handleClick(entidade.sigla)}
            title={entidade.descricao}
          >
            <span className="tabela-icone">📋</span>
            <span className="tabela-nome">{entidade.nome}</span>
          </button>
        ))}
      </div>}
    </div>
  )
}

export default PainelTabelas
