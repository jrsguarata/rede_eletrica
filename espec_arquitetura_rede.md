# Sistema de Gestão de Rede de Distribuição Elétrica
**Arquitetura Completa - Tempo Real + Dados Geoespaciais**

## 📋 Visão Geral

Sistema web para gestão de redes de distribuição de energia elétrica com:
- **Dados Estáticos**: BDGD (Base de Dados Geográfica da Distribuidora) da ANEEL
- **Dados Dinâmicos**: Telemetria de transformadores a cada 5 minutos
- **Visualização**: Mapas georreferenciados interativos
- **Análise**: Cálculos elétricos e detecção de anomalias em tempo real

---

## 🏗️ Arquitetura do Sistema

### Diagrama Geral

```
┌─────────────────────────────────────────────────────────────────┐
│               DISPOSITIVOS DE CAMPO (RTUs/Medidores)            │
│                    Telemetria a cada 5 minutos                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ MQTT/HTTP
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA DE INGESTÃO                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ MQTT Broker  │→ │  FastAPI     │→ │   Kafka      │         │
│  │ (Mosquitto)  │  │  (Ingestão)  │  │  (opcional)  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              CAMADA DE PROCESSAMENTO                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  FastAPI Backend (Workers Async)                         │  │
│  │  - Validação de telemetria                               │  │
│  │  - Detecção de anomalias (sobrecarga, temperatura)       │  │
│  │  - Cálculos elétricos (pandapower)                       │  │
│  │  - Pub/Sub para clientes WebSocket                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└──┬──────────────────────┬──────────────────────┬───────────────┘
   │                      │                      │
   ↓                      ↓                      ↓
┌──────────┐      ┌──────────────┐      ┌─────────────────┐
│  Redis   │      │ TimescaleDB  │      │ PostgreSQL +    │
│          │      │              │      │    PostGIS      │
│ - Cache  │      │ - Séries     │      │                 │
│ - Pub/Sub│      │   temporais  │      │ - BDGD (estát.) │
│ - Último │      │ - Agregações │      │ - Topologia     │
│   valor  │      │ - Retenção   │      │ - Ativos        │
└──────────┘      └──────────────┘      └─────────────────┘
   │                      │                      │
   └──────────────────────┴──────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                   CAMADA DE API                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  FastAPI (REST + WebSocket)                            │    │
│  │                                                         │    │
│  │  REST:                                                  │    │
│  │  - GET /tiles/{z}/{x}/{y} (rede estática)             │    │
│  │  - GET /alimentador/{id} (topologia)                   │    │
│  │  - GET /telemetria/{id}/historico (séries temporais)   │    │
│  │  - POST /calculos/fluxo (análise elétrica)            │    │
│  │                                                         │    │
│  │  WebSocket:                                             │    │
│  │  - /ws/telemetria (streaming 5min)                     │    │
│  │  - /ws/alertas (notificações)                          │    │
│  └────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                           │
│  ┌─────────────────────┐  ┌──────────────────────────────┐     │
│  │  Camada Estática    │  │  Camada Tempo Real           │     │
│  │  (Tiles Vetoriais)  │  │  (WebSocket + Overlay)       │     │
│  │                     │  │                              │     │
│  │  - Segmentos MT/BT  │  │  - Status transformadores    │     │
│  │  - Subestações      │  │  - Cores por estado          │     │
│  │  - MapLibre GL      │  │  - Atualiza a cada 5min      │     │
│  │  - pg_tileserv      │  │  - Alertas visuais           │     │
│  └─────────────────────┘  └──────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Camada de Dados

### 1. PostgreSQL + PostGIS (Dados Estáticos - BDGD)

**Propósito**: Armazenar cadastro de ativos da rede elétrica
**Tabelas**: Estão armazenadas tanto as tabelas com dados espaciais quando as tabelas somente de atributos
**Particionamento**: As tabelas do BDGD estão particionadas com base no arquivo .gdb d que foram carregadas no banco. 
**Tabela de Particionamento**: A tabela que controla o particionamento este descrita a seguir. A coluna id_importado é utlizado no particionamento.
``` sql
CREATE TABLE public.importados (
	id_importado serial4 NOT NULL,
	nome text NOT NULL,
	CONSTRAINT importados_pkey PRIMARY KEY (id_importado)
);
```

**Chave primaria de cada tabela**: as tabelas do BGDD possuem como chave primaria (id_importado, id), ode id_importado é o campo de particionamento e id é o identficador único de cada registro.

**Tabelas espaciais** As tabelas com dados espaciais para exibição no mapa estão armazenadas na tabela entgeo, cujo layout está a seguir
```sql
CREATE TABLE public.entgeo (
	nome text NULL,   --- nome literal da entidade
	sigla text NULL,  --- nome da tabela física no banco
	tipo_de_feicao text NULL, --- topologia do campo geom
	descricao text NULL --- descrição ampla da tabela
);

```
**Tabelas Alfanuméricas** As tabelas somente com dados tabulares estão armazenadas na tabela enttab, cujo layout está a seguir
```sql
CREATE TABLE public.enttab (
	nome text NULL,   --- nome literal da entidade
	sigla text NULL,  --- nome da tabela física no banco
	descricao text NULL --- descrição ampla da tabela
);

```
**Relação de tabelas espaciais**: 
'Subestação'	sub
'Unidade Consumidora de Baixa Tensão'	ucbt
'Unidade Consumidora de Média Tensão'	ucmt
'Unidade Consumidora de Alta Tensão'	ucat
'Unidade Geradora de Baixa Tensão'	ugbt
'Unidade Geradora de Média Tensão'	ugmt
'Unidade Geradora de Alta Tensão'	ugat
'Ponto Notável'	ponnot
'Segmento do Sistema de Distribuição de Baixa Tensão'	ssdbt
'Segmento do Sistema de Distribuição de Média Tensão'	ssdmt
'Segmento do Sistema de Distribuição de Alta Tensão'	ssdat
'Unidade Compensadora de Reativo de Baixa Tensão'	uncrbt
'Unidade Compensadora de Reativo de Média Tensão'	uncrmt
'Unidade Compensadora de Reativo de Alta Tensão'	uncrat
'Unidade Reguladora de Média Tensão'	unremt
'Unidade Reguladora de Alta Tensão'	unreat
'Unidade Seccionadora de Baixa Tensão'	unsebt
'Unidade Seccionadora de Média Tensão'	unsemt
'Unidade Seccionadora de Alta Tensão'	unseat
'Unidade Transformadora de Subestação'	untrs
'Unidade Transformadora de Distribuição'	untrd
'Conjunto'	conj
'Área de Atuação'	arat

**Relação de tabelas afanuméricas**: 
'Ramal de Ligação'	ramlig
'Barramento'	bar
'Circuito de Alta Tensão'	ctat
'Circuito de Média Tensão'	ctmt
'Equipamento Medidor'	eqme
'Equipamento Regulador'	eqre
'Equipamento Seccionador'	eqse
'Equipamento Transformador de Subestação'	eqtrs
'Equipamento Transformador de Distribuição'	eqtrd
'Equipamento Transformador de Medida'	eqtrm
'Equipamento Compensador de Reativo'	eqcr
'Equipamento Sistema de Aterramento'	eqsiat
'Equipamento Transformador de Serviço Auxiliar'	eqtrsx
'Segmento Condutor'	segcon
'Indicadores Gerenciais'	indger
'Base'	base
'Bay'	bay
'Ponto de Iluminação Pública'	pip
'Balanço de Energia'	be
'Energia Passante'	ep
'Perda Técnica'	pt
'Perda Não Técnica'	pnt
'Unidade Consumidora de Baixa Tensão'	ucbt_tab
'Unidade Consumidora de Média Tensão'	ucmt_tab
'Unidade Consumidora de Alta Tensão'	ucat_tab
'Unidade Geradora de Baixa Tensão'	ugbt_tab
'Unidade Geradora de Média Tensão'	ugmt_tab
'Unidade Geradora de Alta Tensão'	ugat_tab

### 2. TimescaleDB (Séries Temporais)

**Propósito**: Telemetria de transformadores (5 em 5 minutos)

**Tabela Principal**:
```sql
CREATE TABLE telemetria_transformador (
    timestamp TIMESTAMPTZ NOT NULL,
    cod_transformador VARCHAR(20) NOT NULL,
    tensao_primario FLOAT,      -- kV
    tensao_secundario FLOAT,    -- V
    corrente_a FLOAT,           -- A
    corrente_b FLOAT,           -- A
    corrente_c FLOAT,           -- A
    potencia_ativa FLOAT,       -- kW
    potencia_reativa FLOAT,     -- kVAr
    temperatura FLOAT,          -- °C
    status VARCHAR(20),         -- NORMAL, ALERTA, CRITICO
    PRIMARY KEY (timestamp, cod_transformador)
);

-- Converter para hypertable
SELECT create_hypertable('telemetria_transformador', 'timestamp');

-- Política de retenção (90 dias de dados brutos)
SELECT add_retention_policy('telemetria_transformador', INTERVAL '90 days');
```

**Agregações Contínuas**:
```sql
-- Médias por hora (para consultas históricas rápidas)
CREATE MATERIALIZED VIEW telemetria_1h
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', timestamp) AS bucket,
    cod_transformador,
    AVG(tensao_primario) as tensao_avg,
    AVG(potencia_ativa) as potencia_avg,
    MAX(temperatura) as temp_max
FROM telemetria_transformador
GROUP BY bucket, cod_transformador;
```

### 3. Redis (Cache + Pub/Sub)

**Propósito**: Cache de último valor e distribuição de eventos

**Estruturas**:
```
# Último valor de telemetria (hash)
telemetria:ultimo:{cod_transformador}
  - timestamp
  - tensao_primario
  - potencia_ativa
  - temperatura
  - status
  
# Alertas ativos (sorted set)
alertas:{cod_transformador}
  - {anomalia_json} : timestamp

# Canais Pub/Sub
telemetria:stream  → dados em tempo real
alertas:stream     → notificações de alertas
```

---

## 🔧 Backend - FastAPI

### Estrutura de Pastas

```
backend/
├── app/
│   ├── main.py                 # App FastAPI principal
│   ├── config.py               # Configurações (DB, Redis, MQTT)
│   ├── models/
│   │   ├── bdgd.py            # Models BDGD (PostgreSQL)
│   │   └── telemetria.py      # Models telemetria (TimescaleDB)
│   ├── schemas/
│   │   ├── telemetria.py      # Pydantic schemas
│   │   └── rede.py
│   ├── api/
│   │   ├── tiles.py           # Endpoints tiles vetoriais
│   │   ├── telemetria.py      # REST telemetria
│   │   ├── websocket.py       # WebSocket streaming
│   │   └── calculos.py        # Análises elétricas
│   ├── services/
│   │   ├── ingestao.py        # MQTT → TimescaleDB
│   │   ├── anomalias.py       # Detecção de anomalias
│   │   └── calculos.py        # pandapower
│   └── utils/
│       ├── geo.py             # Funções geoespaciais
│       └── cache.py           # Helpers Redis
├── requirements.txt
├── docker-compose.yml
└── README.md
```

### Principais Componentes

#### 1. Ingestão de Telemetria (MQTT)

```python
# services/ingestao.py

async def processar_telemetria(topic: str, payload: bytes):
    """
    Processa telemetria recebida via MQTT:
    1. Valida dados
    2. Salva no TimescaleDB (histórico)
    3. Atualiza Redis (último valor)
    4. Detecta anomalias
    5. Publica para WebSocket clients
    """
    dados = json.loads(payload)
    cod_transformador = topic.split('/')[-1]
    
    # 1. Salvar no TimescaleDB
    await salvar_timescale(cod_transformador, dados)
    
    # 2. Atualizar Redis (cache)
    await redis.hset(f"telemetria:ultimo:{cod_transformador}", mapping=dados)
    await redis.expire(f"telemetria:ultimo:{cod_transformador}", 600)  # 10min
    
    # 3. Detectar anomalias
    anomalias = await detectar_anomalias(cod_transformador, dados)
    
    # 4. Publicar para clientes WebSocket
    await redis.publish('telemetria:stream', json.dumps({
        'cod_transformador': cod_transformador,
        'dados': dados,
        'anomalias': anomalias
    }))
```

#### 2. Detecção de Anomalias

```python
# services/anomalias.py

async def detectar_anomalias(cod_transformador: str, dados: dict) -> list:
    """Detecta condições anormais"""
    anomalias = []
    
    # Busca dados cadastrais do transformador
    trafo = await db.get(Transformador, cod_transformador)
    
    # Sobrecarga (>100% potência nominal)
    carregamento = (dados['potencia_ativa'] / trafo.pot_nom) * 100
    if carregamento > 100:
        anomalias.append({
            'tipo': 'SOBRECARGA',
            'severidade': 'CRITICO' if carregamento > 120 else 'ALERTA',
            'valor': carregamento
        })
    
    # Temperatura elevada
    if dados['temperatura'] > 80:
        anomalias.append({
            'tipo': 'TEMPERATURA_ALTA',
            'severidade': 'CRITICO' if dados['temperatura'] > 95 else 'ALERTA',
            'valor': dados['temperatura']
        })
    
    # Subtensão
    if dados['tensao_primario'] < trafo.ten_pri * 0.9:
        anomalias.append({
            'tipo': 'SUBTENSAO',
            'severidade': 'ALERTA',
            'valor': dados['tensao_primario']
        })
    
    # Desequilíbrio de fases (>10%)
    correntes = [dados['corrente_a'], dados['corrente_b'], dados['corrente_c']]
    media = sum(correntes) / 3
    desequilibrio = max(abs(i - media) / media * 100 for i in correntes)
    if desequilibrio > 10:
        anomalias.append({
            'tipo': 'DESEQUILIBRIO_FASES',
            'severidade': 'ALERTA',
            'valor': desequilibrio
        })
    
    return anomalias
```

#### 3. WebSocket Streaming

```python
# api/websocket.py

@app.websocket("/ws/telemetria")
async def websocket_telemetria(websocket: WebSocket):
    """
    WebSocket para streaming de telemetria
    
    Cliente → Servidor:
    {"action": "subscribe", "transformadores": ["TR-001", "TR-002"]}
    
    Servidor → Cliente (a cada 5min):
    {"tipo": "telemetria", "cod_transformador": "TR-001", "dados": {...}}
    """
    await manager.connect(websocket)
    
    # Task para escutar Redis Pub/Sub
    async def redis_listener():
        pubsub = redis_client.pubsub()
        await pubsub.subscribe('telemetria:stream')
        
        async for message in pubsub.listen():
            if message['type'] == 'message':
                dados = json.loads(message['data'])
                await manager.broadcast_telemetria(
                    dados['cod_transformador'],
                    dados
                )
    
    listener_task = asyncio.create_task(redis_listener())
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data['action'] == 'subscribe':
                for cod in data['transformadores']:
                    await manager.subscribe(websocket, cod)
                    
                    # Envia snapshot do último valor (Redis)
                    ultimo = await redis.hgetall(f"telemetria:ultimo:{cod}")
                    await websocket.send_json({
                        'tipo': 'snapshot',
                        'cod_transformador': cod,
                        'dados': ultimo
                    })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        listener_task.cancel()
```

#### 4. Endpoints REST

```python
# api/telemetria.py

@app.get("/telemetria/transformador/{cod_id}/atual")
async def telemetria_atual(cod_id: str):
    """Último valor (Redis - rápido)"""
    dados = await redis.hgetall(f"telemetria:ultimo:{cod_id}")
    return {"cod_transformador": cod_id, "telemetria": dados}


@app.get("/telemetria/transformador/{cod_id}/historico")
async def telemetria_historico(
    cod_id: str,
    inicio: datetime,
    fim: datetime,
    agregacao: str = "5m"  # 5m, 1h, 1d
):
    """Histórico de telemetria (TimescaleDB)"""
    if agregacao == "5m":
        # Dados brutos
        query = select(TelemetriaTransformador).where(...)
    else:
        # Dados agregados (materialized view)
        query = text("SELECT * FROM telemetria_1h WHERE ...")
    
    result = await db.execute(query)
    return result.fetchall()


@app.get("/mapa/transformadores/status")
async def status_transformadores_mapa(bbox: str):
    """
    Status de transformadores no viewport
    Combina PostGIS (localização) + Redis (telemetria)
    """
    # 1. Busca transformadores na área (PostGIS)
    coords = [float(x) for x in bbox.split(',')]
    trafos = await db.execute(
        select(Transformador).where(
            ST_Intersects(Transformador.geom, ST_MakeEnvelope(*coords))
        )
    )
    
    # 2. Busca telemetria de cada um (Redis - paralelo)
    telemetrias = await asyncio.gather(*[
        redis.hgetall(f"telemetria:ultimo:{t.cod_id}") 
        for t in trafos
    ])
    
    # 3. Combina em GeoJSON
    return {"type": "FeatureCollection", "features": [...]}
```

#### 5. Cálculos Elétricos (pandapower)

```python
# api/calculos.py

@app.post("/calculos/fluxo-carga/{ctmt}")
async def calcular_fluxo_alimentador(ctmt: str):
    """
    Monta rede pandapower a partir do BDGD e calcula fluxo
    """
    # 1. Buscar topologia do BDGD
    segmentos = await buscar_segmentos(ctmt)
    transformadores = await buscar_transformadores(ctmt)
    cargas = await buscar_cargas(ctmt)
    
    # 2. Criar rede pandapower
    net = pp.create_empty_network()
    
    # 3. Adicionar elementos
    for seg in segmentos:
        pp.create_line(net, from_bus=seg.pac_1, to_bus=seg.pac_2, ...)
    
    for trafo in transformadores:
        pp.create_transformer(net, ...)
    
    for carga in cargas:
        # Usar telemetria real se disponível
        telemetria = await redis.hgetall(f"telemetria:ultimo:{carga.cod_id}")
        demanda = telemetria.get('potencia_ativa', carga.dem_cont)
        pp.create_load(net, p_mw=demanda/1000)
    
    # 4. Calcular fluxo de potência
    pp.runpp(net)
    
    return {
        "perdas_totais_mw": net.res_line.pl_mw.sum(),
        "carregamento_linhas": net.res_line.loading_percent.to_dict(),
        "tensoes_barras": net.res_bus.vm_pu.to_dict()
    }
```

---

## 🗺️ Visualização - Tiles Vetoriais

### Servidor de Tiles: pg_tileserv

**Por quê pg_tileserv?**
- ✅ Otimizado para PostGIS
- ✅ Cache interno eficiente
- ✅ 10-50ms por tile (vs 100-500ms custom)
- ✅ Compressão automática

**Configuração**:
```yaml
# docker-compose.yml
services:
  pg_tileserv:
    image: pramsey/pg_tileserv:latest
    environment:
      DATABASE_URL: postgresql://user:pass@postgres/rede_eletrica
    ports:
      - "7800:7800"
```

**URLs de Tiles**:
```
# Segmentos de rede
http://localhost:7800/bdgd.segcon/{z}/{x}/{y}.pbf

# Transformadores
http://localhost:7800/bdgd.unsemt/{z}/{x}/{y}.pbf
```

### Performance Esperada

| Abordagem | Primeira Carga | Pan/Zoom | Uso |
|-----------|---------------|----------|-----|
| GeoJSON completo | 2-4s (ruim) | 1-3s | ❌ Não usar |
| Tiles custom | 1-2s | <100ms | ⚠️ OK |
| pg_tileserv + cache | 300-800ms | <100ms | ✅ Recomendado |

---

## 🎨 Frontend - React + MapLibre GL

### Estratégia de Camadas

```javascript
// Camada 1: ESTÁTICA (tiles vetoriais - muda raramente)
// - Segmentos de rede MT/BT
// - Subestações
// - Cache: 24h

// Camada 2: DINÂMICA (GeoJSON + WebSocket - atualiza a cada 5min)
// - Status de transformadores (cores por estado)
// - Alertas visuais
// - Tooltips com telemetria
```

### Componente Principal

```javascript
// MapaRedeEletrica.jsx

function MapaRedeEletrica() {
  const [transformadores, setTransformadores] = useState({});
  const ws = useRef(null);
  
  useEffect(() => {
    // Inicializa mapa com camada estática (tiles)
    const map = new maplibregl.Map({
      sources: {
        'rede-base': {
          type: 'vector',
          tiles: ['http://localhost:7800/bdgd.segcon/{z}/{x}/{y}.pbf']
        },
        'transformadores-status': {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        }
      },
      layers: [
        // Linhas de rede (estático)
        {
          id: 'rede-mt',
          type: 'line',
          source: 'rede-base',
          paint: { 'line-color': '#666' }
        },
        // Transformadores (dinâmico - atualiza a cada 5min)
        {
          id: 'transformadores',
          type: 'circle',
          source: 'transformadores-status',
          paint: {
            'circle-color': [
              'match', ['get', 'status'],
              'NORMAL', '#00FF00',
              'ALERTA', '#FFA500',
              'CRITICO', '#FF0000',
              'OFFLINE', '#808080',
              '#CCC'
            ]
          }
        }
      ]
    });
    
    // Conecta WebSocket
    ws.current = new WebSocket('ws://localhost:8000/ws/telemetria');
    
    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      // Atualiza estado local
      setTransformadores(prev => ({
        ...prev,
        [msg.cod_transformador]: msg.dados
      }));
    };
    
  }, []);
  
  // Atualiza layer GeoJSON quando telemetria muda
  useEffect(() => {
    const features = Object.entries(transformadores).map(([cod, dados]) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: dados.coordinates },
      properties: {
        cod_id: cod,
        status: dados.status,
        temperatura: dados.temperatura,
        potencia_ativa: dados.potencia_ativa
      }
    }));
    
    map.getSource('transformadores-status').setData({
      type: 'FeatureCollection',
      features
    });
  }, [transformadores]);
  
  return <div ref={mapContainer} />;
}
```

---

## 🐳 Docker Compose

```yaml
version: '3.8'

services:
  # Banco principal - PostgreSQL + PostGIS
  postgres:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_DB: rede_eletrica
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
  
  # TimescaleDB para séries temporais
  timescaledb:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_DB: telemetria
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - timescale_data:/var/lib/postgresql/data
    ports:
      - "5433:5432"
  
  # Redis - cache e pub/sub
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
  
  # MQTT Broker
  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - mosquitto_data:/mosquitto/data
  
  # Servidor de tiles vetoriais
  pg_tileserv:
    image: pramsey/pg_tileserv:latest
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/rede_eletrica
    ports:
      - "7800:7800"
    depends_on:
      - postgres
  
  # Backend FastAPI
  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:postgres@postgres:5432/rede_eletrica
      TIMESCALE_URL: postgresql+asyncpg://postgres:postgres@timescaledb:5432/telemetria
      REDIS_URL: redis://redis:6379
      MQTT_BROKER: mosquitto:1883
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - timescaledb
      - redis
      - mosquitto
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
  
  # Frontend React
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
    environment:
      REACT_APP_API_URL: http://localhost:8000
      REACT_APP_WS_URL: ws://localhost:8000

volumes:
  postgres_data:
  timescale_data:
  redis_data:
  mosquitto_data:
```

---

## 📊 Fluxo de Dados - Tempo Real

### 1. Telemetria (a cada 5 minutos)

```
RTU/Medidor → MQTT → FastAPI (ingestão) → TimescaleDB (histórico)
                                         ↓
                                    Redis (cache)
                                         ↓
                                Redis Pub/Sub
                                         ↓
                               WebSocket Clients
                                         ↓
                              Frontend (atualiza mapa)
```

### 2. Consulta de Mapa (inicial)

```
Frontend → GET /mapa/transformadores/status?bbox=...
              ↓
        FastAPI combina:
              ├─ PostGIS (localização dos transformadores)
              └─ Redis (última telemetria)
              ↓
        GeoJSON com status atual
              ↓
        Frontend renderiza overlay
```

### 3. Streaming Contínuo

```
Frontend conecta WebSocket → subscreve transformadores visíveis
                                         ↓
                            A cada 5min, recebe telemetria
                                         ↓
                            Atualiza cores/tooltips no mapa
```

---

## 🎯 Performance Esperada

### Latência

| Operação | Latência | Observação |
|----------|----------|------------|
| Telemetria → Redis | <10ms | Cache em memória |
| Telemetria → TimescaleDB | 20-50ms | Escrita assíncrona |
| WebSocket delivery | 10-50ms | Pub/Sub via Redis |
| Tile request (cache hit) | <10ms | Nginx/pg_tileserv cache |
| Tile request (cache miss) | 10-50ms | PostGIS otimizado |
| Query histórico (1h, agregado) | 50-200ms | Materialized view |
| Cálculo fluxo (alimentador) | 1-5s | Depende do tamanho |

### Capacidade

| Métrica | Valor | Observação |
|---------|-------|------------|
| Transformadores monitorados | 10.000+ | Depende de hardware |
| Telemetrias/minuto | 2.000 (10k÷5min) | Pico teórico |
| Usuários simultâneos (mapa) | 50-100 | Com cache adequado |
| Retenção dados brutos | 90 dias | TimescaleDB |
| Retenção dados agregados | Ilimitada | Materialized views |

---

