// Cores para cada layer
export const CORES_LAYERS = {
  // Subestações
  sub: '#E74C3C',      // Vermelho

  // Segmentos
  ssdmt: '#3498DB',    // Azul
  ssdbt: '#2ECC71',    // Verde
  ssdat: '#9B59B6',    // Roxo

  // Transformadores
  untrd: '#F39C12',    // Laranja
  untrs: '#E67E22',    // Laranja escuro

  // Unidades consumidoras
  ucbt: '#1ABC9C',     // Turquesa
  ucmt: '#16A085',     // Verde escuro
  ucat: '#27AE60',     // Verde

  // Unidades geradoras
  ugbt: '#8E44AD',     // Roxo escuro
  ugmt: '#9B59B6',     // Roxo
  ugat: '#A569BD',     // Roxo claro

  // Unidades seccionadoras
  unsebt: '#D35400',   // Marrom
  unsemt: '#E74C3C',   // Vermelho
  unseat: '#C0392B',   // Vermelho escuro

  // Unidades reguladoras
  unremt: '#F1C40F',   // Amarelo
  unreat: '#F39C12',   // Amarelo escuro

  // Unidades compensadoras
  uncrbt: '#3498DB',   // Azul
  uncrmt: '#2980B9',   // Azul escuro
  uncrat: '#1ABC9C',   // Turquesa

  // Pontos notáveis
  ponnot: '#95A5A6',   // Cinza

  // Área de atuação
  arat: '#BDC3C7',     // Cinza claro

  // Conjunto
  conj: '#7F8C8D',     // Cinza escuro

  // Default
  default: '#34495E'   // Cinza azulado
}

// Estilos base por tipo de geometria
export const ESTILOS_GEOMETRIA = {
  Point: {
    'circle-radius': 6,
    'circle-stroke-width': 1,
    'circle-stroke-color': '#FFFFFF'
  },
  LineString: {
    'line-width': 2,
    'line-cap': 'round',
    'line-join': 'round'
  },
  MultiLineString: {
    'line-width': 2,
    'line-cap': 'round',
    'line-join': 'round'
  },
  Polygon: {
    'fill-opacity': 0.3,
    'fill-outline-color': '#000000'
  },
  MultiPolygon: {
    'fill-opacity': 0.3,
    'fill-outline-color': '#000000'
  }
}

// Obtém cor do layer
export const getCorLayer = (sigla) => {
  return CORES_LAYERS[sigla] || CORES_LAYERS.default
}

// Obtém estilo completo para um layer
export const getEstiloLayer = (sigla, tipoGeom) => {
  const cor = getCorLayer(sigla)
  const estiloBase = ESTILOS_GEOMETRIA[tipoGeom] || {}

  if (tipoGeom === 'Point') {
    return {
      ...estiloBase,
      'circle-color': cor
    }
  } else if (tipoGeom === 'LineString' || tipoGeom === 'MultiLineString') {
    return {
      ...estiloBase,
      'line-color': cor
    }
  } else if (tipoGeom === 'Polygon' || tipoGeom === 'MultiPolygon') {
    return {
      ...estiloBase,
      'fill-color': cor
    }
  }

  return estiloBase
}
