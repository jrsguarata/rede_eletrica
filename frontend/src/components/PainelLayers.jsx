import { useState } from 'react'
import { useBDGD } from '../context/BDGDContext'
import { getCorLayer } from '../utils/cores'
import './PainelLayers.css'

function PainelLayers({ entidades }) {
  const { layersAtivos, toggleLayer } = useBDGD()
  const [expandido, setExpandido] = useState(true)

  return (
    <div className="painel-layers">
      <button className="painel-header" onClick={() => setExpandido(!expandido)}>
        <span className={`painel-seta ${expandido ? 'expandido' : ''}`}>▶</span>
        <h2>Camadas</h2>
        <span className="painel-contador">{layersAtivos.length}/{entidades.length}</span>
      </button>
      {expandido && <div className="layers-lista">
        {entidades.map((entidade) => {
          const isAtivo = layersAtivos.includes(entidade.sigla)
          const cor = getCorLayer(entidade.sigla)

          return (
            <label key={entidade.sigla} className="layer-item">
              <input
                type="checkbox"
                checked={isAtivo}
                onChange={() => toggleLayer(entidade.sigla)}
              />
              <span
                className="layer-cor"
                style={{ backgroundColor: cor }}
              />
              <span className="layer-nome" title={entidade.descricao}>
                {entidade.nome}
              </span>
              <span className="layer-sigla">{entidade.sigla.toUpperCase()}</span>
            </label>
          )
        })}
      </div>}
    </div>
  )
}

export default PainelLayers
