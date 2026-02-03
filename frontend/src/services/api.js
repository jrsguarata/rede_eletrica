import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const TILES_URL = import.meta.env.VITE_TILES_URL || 'http://localhost:7800'

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000
})

export const bdgdApi = {
  // Lista arquivos importados
  getImportados: async () => {
    const response = await api.get('/api/importados')
    return response.data.importados
  },

  // Lista entidades geográficas (layers)
  getEntidadesGeo: async () => {
    const response = await api.get('/api/entgeo')
    return response.data.entidades
  },

  // Lista entidades tabulares
  getEntidadesTab: async () => {
    const response = await api.get('/api/enttab')
    return response.data.entidades
  },

  // Obtém área de atuação e bbox
  getAreaAtuacao: async (idImportado) => {
    const response = await api.get(`/api/arat/${idImportado}`)
    return response.data
  },

  // Obtém dados tabulares
  getDadosTabulares: async (tabela, idImportado, limit = 200, offset = 0) => {
    const response = await api.get(`/api/tabular/${tabela}`, {
      params: { id_importado: idImportado, limit, offset }
    })
    return response.data
  },

  // Obtém detalhes de um registro
  getRegistro: async (tabela, codId, idImportado) => {
    const response = await api.get(`/api/registro/${tabela}/${codId}`, {
      params: { id_importado: idImportado }
    })
    return response.data
  }
}

// Funções auxiliares para tiles
// pg_tileserv usa tabelas particionadas: public.ssdmt_6, public.ssdmt_7, etc.
export const getTileUrl = (tabela, idImportado) => {
  return `${TILES_URL}/public.${tabela}_${idImportado}/{z}/{x}/{y}.pbf`
}

// Retorna o nome do source-layer para MapLibre
export const getSourceLayer = (tabela, idImportado) => {
  return `public.${tabela}_${idImportado}`
}

export const TILES_BASE_URL = TILES_URL

export default api
