import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import { useBDGD } from '../context/BDGDContext'
import { useAuth } from '../context/AuthContext'
import { bdgdApi, getTileUrl, getSourceLayer } from '../services/api'
import { getCorLayer } from '../utils/cores'
import PainelLayers from '../components/PainelLayers'
import PainelTabelas from '../components/PainelTabelas'
import ModalDetalhes from '../components/ModalDetalhes'
import './MapaPrincipal.css'

function MapaPrincipal() {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [featureSelecionada, setFeatureSelecionada] = useState(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [mapaFundo, setMapaFundo] = useState('osm') // 'osm', 'google', 'none'
  const [controleFundoAberto, setControleFundoAberto] = useState(false)

  const {
    idImportado,
    arquivoSelecionado,
    entidadesGeo,
    entidadesTab,
    bbox,
    layersAtivos,
    setEntidadesGeo,
    setEntidadesTab,
    setBbox,
    setAreaAtuacao
  } = useBDGD()

  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Redireciona se não houver arquivo selecionado
  useEffect(() => {
    if (!idImportado) {
      navigate('/')
    }
  }, [idImportado, navigate])

  // Carrega metadados
  useEffect(() => {
    if (idImportado) {
      carregarMetadados()
    }
  }, [idImportado])

  // Inicializa o mapa
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          },
          'google-satellite': {
            type: 'raster',
            tiles: [
              'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
            ],
            tileSize: 256,
            attribution: '© Google'
          }
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19
          },
          {
            id: 'google-satellite-tiles',
            type: 'raster',
            source: 'google-satellite',
            minzoom: 0,
            maxzoom: 20,
            layout: {
              visibility: 'none'
            }
          }
        ]
      },
      center: [-46.6, -23.5],
      zoom: 10
    })

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.current.addControl(new maplibregl.ScaleControl(), 'bottom-left')

    map.current.on('load', () => {
      setMapLoaded(true)
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Centraliza no bbox quando disponível
  useEffect(() => {
    if (mapLoaded && bbox && map.current) {
      map.current.fitBounds(bbox, {
        padding: 50,
        duration: 1000
      })
    }
  }, [mapLoaded, bbox])

  // Controla visibilidade do mapa de fundo
  useEffect(() => {
    if (!mapLoaded || !map.current || !map.current.isStyleLoaded()) return
    try {
      map.current.setLayoutProperty('osm-tiles', 'visibility', mapaFundo === 'osm' ? 'visible' : 'none')
      map.current.setLayoutProperty('google-satellite-tiles', 'visibility', mapaFundo === 'google' ? 'visible' : 'none')
    } catch (err) {
      console.warn('Erro ao alterar visibilidade do mapa de fundo:', err)
    }
  }, [mapLoaded, mapaFundo])

  // Adiciona/remove layers conforme seleção
  useEffect(() => {
    if (!mapLoaded || !map.current || !idImportado || !map.current.isStyleLoaded()) return

    // Adiciona layers ativos
    entidadesGeo.forEach((entidade) => {
      const layerId = `layer-${entidade.sigla}`
      const sourceId = `source-${entidade.sigla}`
      const isAtivo = layersAtivos.includes(entidade.sigla)

      if (isAtivo && !map.current.getSource(sourceId)) {
        // Adiciona source do pg_tileserv
        map.current.addSource(sourceId, {
          type: 'vector',
          tiles: [getTileUrl(entidade.sigla, idImportado)],
          minzoom: 0,
          maxzoom: 22
        })

        // Adiciona layer conforme tipo de geometria
        const cor = getCorLayer(entidade.sigla)
        const tipoGeom = entidade.tipo_geom

        const sourceLayerName = getSourceLayer(entidade.sigla, idImportado)

        // Mapeia tipos de geometria em português para estilos MapLibre
        const tipoNormalizado = tipoGeom?.toLowerCase()
        const isPonto = tipoNormalizado === 'ponto' || tipoNormalizado === 'point'
        const isLinha = tipoNormalizado === 'linha' || tipoNormalizado === 'linestring'
        const isPoligono = tipoNormalizado === 'polígono' || tipoNormalizado === 'polygon'

        if (isPonto) {
          map.current.addLayer({
            id: layerId,
            type: 'circle',
            source: sourceId,
            'source-layer': sourceLayerName,
            paint: {
              'circle-radius': 6,
              'circle-color': cor,
              'circle-stroke-width': 1,
              'circle-stroke-color': '#ffffff'
            }
          })
        } else if (isLinha) {
          map.current.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            'source-layer': sourceLayerName,
            paint: {
              'line-color': cor,
              'line-width': 2
            }
          })
        } else if (isPoligono) {
          map.current.addLayer({
            id: layerId,
            type: 'fill',
            source: sourceId,
            'source-layer': sourceLayerName,
            paint: {
              'fill-color': cor,
              'fill-opacity': 0.3,
              'fill-outline-color': cor
            }
          })
        }

        // Adiciona evento de click no layer
        map.current.on('click', layerId, (e) => {
          if (e.features && e.features.length > 0) {
            const feature = e.features[0]
            setFeatureSelecionada({
              tabela: entidade.sigla,
              nome: entidade.nome,
              properties: feature.properties
            })
            setModalAberto(true)
          }
        })

        // Cursor pointer ao passar sobre features
        map.current.on('mouseenter', layerId, () => {
          map.current.getCanvas().style.cursor = 'pointer'
        })

        map.current.on('mouseleave', layerId, () => {
          map.current.getCanvas().style.cursor = ''
        })
      } else if (!isAtivo && map.current.getLayer(layerId)) {
        // Remove layer e source
        map.current.removeLayer(layerId)
        map.current.removeSource(sourceId)
      }
    })
  }, [mapLoaded, layersAtivos, entidadesGeo, idImportado])

  const carregarMetadados = async () => {
    try {
      // Carrega em paralelo
      const [geo, tab, area] = await Promise.all([
        bdgdApi.getEntidadesGeo(),
        bdgdApi.getEntidadesTab(),
        bdgdApi.getAreaAtuacao(idImportado)
      ])

      setEntidadesGeo(geo)
      setEntidadesTab(tab)
      setAreaAtuacao(area.geojson)
      setBbox(area.bbox)
    } catch (err) {
      console.error('Erro ao carregar metadados:', err)
    }
  }

  const handleVoltarSelecao = () => {
    navigate('/')
  }

  if (!idImportado) {
    return null
  }

  return (
    <div className="mapa-container">
      <header className="mapa-header">
        <button className="btn-voltar" onClick={handleVoltarSelecao}>
          ← Voltar
        </button>
        <h1>{arquivoSelecionado?.nome || 'BDGD'}</h1>
        <span className="user-info">{user?.name}</span>
        <button className="btn-sair-header" onClick={logout}>Sair</button>
      </header>

      <div className="mapa-content">
        <aside className="painel-lateral">
          <PainelLayers entidades={entidadesGeo} />
          <PainelTabelas entidades={entidadesTab} />
        </aside>

        <main className="mapa-wrapper">
          <div ref={mapContainer} className="mapa" />

          <div className={`controle-mapa-fundo ${controleFundoAberto ? 'aberto' : ''}`}>
            <button
              className="controle-toggle"
              onClick={() => setControleFundoAberto(!controleFundoAberto)}
              title="Mapa de fundo"
            >
              <span className="controle-icone">🗺</span>
              {controleFundoAberto && <span className="controle-fechar">×</span>}
            </button>
            {controleFundoAberto && (
              <div className="controle-conteudo">
                <div className="controle-titulo">Mapa de fundo</div>
                <div className="controle-opcoes">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="mapaFundo"
                      value="osm"
                      checked={mapaFundo === 'osm'}
                      onChange={(e) => setMapaFundo(e.target.value)}
                    />
                    <span>OSM</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="mapaFundo"
                      value="google"
                      checked={mapaFundo === 'google'}
                      onChange={(e) => setMapaFundo(e.target.value)}
                    />
                    <span>Satélite</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="mapaFundo"
                      value="none"
                      checked={mapaFundo === 'none'}
                      onChange={(e) => setMapaFundo(e.target.value)}
                    />
                    <span>Nenhum</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {modalAberto && featureSelecionada && (
        <ModalDetalhes
          tabela={featureSelecionada.tabela}
          nome={featureSelecionada.nome}
          properties={featureSelecionada.properties}
          onClose={() => setModalAberto(false)}
        />
      )}
    </div>
  )
}

export default MapaPrincipal
