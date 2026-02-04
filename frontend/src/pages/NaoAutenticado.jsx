import './NaoAutenticado.css'

function NaoAutenticado({ error }) {
  return (
    <div className="nao-autenticado-container">
      <div className="nao-autenticado-card">
        <h1>Acesso Restrito</h1>
        <p>Esta aplicacao deve ser acessada pelo painel do SignOn.</p>
        {error && (
          <div className="erro-sso">{error}</div>
        )}
        <a
          href="http://localhost:5178/dashboard/my-apps"
          className="btn-signon"
        >
          Ir para o SignOn
        </a>
      </div>
    </div>
  )
}

export default NaoAutenticado
