import './ModalDetalhes.css'

function ModalDetalhes({ tabela, nome, properties, onClose }) {
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
              {propriedades.map(([chave, valor]) => (
                <div key={chave} className="propriedade-item">
                  <dt>{chave}</dt>
                  <dd title={formatarValor(valor)}>
                    {formatarValor(valor)}
                  </dd>
                </div>
              ))}
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
