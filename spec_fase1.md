# Especificação Técnica - Fase 1
## Visualização dos Dados do BDGD

**Versão**: 1.0  
**Data**: Fevereiro 2026  
**Escopo**: Consulta e visualização dos dados do BDGD armazenados no PostgreSQL (banco teste, schema public)

---

## 1. Visão Geral

A Fase 1 do projeto é constituída exclusivamente pela **visualização dos dados do BDGD** já importados no PostgreSQL. Não há criação, alteração ou exclusão de dados. Todas as operações são de consulta (SELECT).

### 1.1 Premissas

- Dados já importados no banco **teste**, schema **public**
- Tabelas particionadas por **id_importado**
- Tabela de controle **importados** já populada
- Tabelas de metadados **entgeo** (entidades geográficas) e **entab** (entidades tabulares) já existem
- Tabela **arat** contém a área de atuação da distribuidora
- Backend: **FastAPI** (Python)
- Frontend: **React** + **MapLibre GL** + **pg_tileserv**
- Banco: **PostgreSQL + PostGIS**

### 1.2 Limitações da Fase 1

- Sem autenticação/autorização
- Sem edição de dados
- Sem telemetria
- Sem cálculos elétricos
- Sem exportação de dados

---

## 2. Estrutura de Dados Envolvida

### 2.1 Tabela de Controle de Importações

```sql
-- Tabela que lista os arquivos BDGD importados
-- Usada na tela de seleção inicial
public.importados
├── id_importado (PK) → usado para particionar todas as tabelas
├── nome_arquivo
├── distribuidora
├── codigo_aneel
├── data_referencia
├── versao_modelo
├── timestamp_geracao
└── data_importacao
```

### 2.2 Tabela de Metadados - Entidades Geográficas

```sql
-- Define quais tabelas são geográficas (têm geometria)
-- Usado para montar o painel de layers no mapa
public.entgeo
├── id
├── nome_tabela    → nome da tabela no banco (ex: 'segcon')
├── sigla          → nome exibido no painel de layers (ex: 'SEGCON - Segmentos')
├── tipo_geom      → tipo de geometria (POINT, LINESTRING, POLYGON)
└── descricao      → descrição da entidade
```

### 2.3 Tabela de Metadados - Entidades Tabulares

```sql
-- Define quais tabelas são não-geográficas (sem geometria)
-- Usado para montar o painel de consulta tabular
public.entab
├── id
├── nome_tabela    → nome da tabela no banco (ex: 'tcabobit')
├── nome_tabela_exibicao → nome exibido na UI (ex: 'Tipos de Cabo - Bitola')
└── descricao      → descrição da entidade
```

### 2.4 Tabela de Área de Atuação

```sql
-- Polígono que define a área de atuação da distribuidora
-- Usado para centralizar/limitar o mapa na abertura
public.arat
├── id_importado (FK → importados)
├── cod_id
├── geometry       → POLYGON/MULTIPOLYGON (área de atuação)
└── descr
```

### 2.5 Tabelas Geográficas Principais (Exemplos)

```sql
-- Subestações Alta Tensão
public.ssdmt  (id_importado, cod_id, geometry POINT, ...)

-- Subestações Baixa Tensão  
public.ssdbt  (id_importado, cod_id, geometry POINT, ...)

-- Segmentos de condutores
public.segcon (id_importado, cod_id, geometry LINESTRING, ctmt, ...)

-- Transformadores
public.unsemt (id_importado, cod_id, geometry POINT, pot_nom, ...)

-- Unidades consumidoras
public.ucbt   (id_importado, cod_id, geometry POINT, tip_cc, ...)

-- Circuitos Média Tensão
public.ctmt   (id_importado, cod_id, geometry LINESTRING/MULTILINESTRING, ...)

-- ... outras entidades geográficas
```

---

## 3. Fluxo da Aplicação

### 3.1 Diagrama de Fluxo Geral

```
┌─────────────────────────────────────────────────────────┐
│  ABERTURA DO SISTEMA                                    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Tela de Seleção de Arquivo                     │    │
│  │  - Lista arquivos da tabela "importados"        │    │
│  │  - Exibe: nome_arquivo, distribuidora,          │    │
│  │           data_referencia, versao_modelo         │    │
│  │  - Usuário seleciona um arquivo                 │    │
│  │  - Sistema captura id_importado                 │    │
│  └─────────────────────┬───────────────────────────┘    │
└────────────────────────┼────────────────────────────────┘
                         │ id_importado selecionado
                         ▼
┌─────────────────────────────────────────────────────────┐
│  CONFIGURAÇÃO DO MAPA                                   │
│  - Busca geometria da área de atuação em "arat"         │
│  - Calcula bbox da geometria                            │
│  - Centraliza e ajusta zoom do mapa                     │
│  - Desenha layers iniciais: ssdmt + ssdbt               │
└─────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  TELA PRINCIPAL                                         │
│  ┌──────────────────┐  ┌──────────────────────────┐    │
│  │  Painel Layers   │  │  Mapa (MapLibre GL)      │    │
│  │  (entgeo)        │  │                          │    │
│  │  - Lista layers  │  │  - Área de atuação       │    │
│  │  - Checkbox ON/  │  │  - Layers selecionados   │    │
│  │    OFF           │  │  - Zoom/Pan/Identificar  │    │
│  │  - Sigla do layer│  │  - Click → info feature  │    │
│  └──────────────────┘  └──────────────────────────┘    │
│                                                         │
│  ┌──────────────────┐                                   │
│  │  Painel Tabelas  │                                   │
│  │  (entab)         │                                   │
│  │  - Lista tabelas │                                   │
│  │  - Seleção       │                                   │
│  │    → Abre tela   │                                   │
│  │      tabular     │                                   │
│  └──────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
                         │ Usuário seleciona tabela (entab)
                         ▼
┌─────────────────────────────────────────────────────────┐
│  TELA DE CONSULTA TABULAR                               │
│  - Exibe registros da tabela selecionada                │
│  - Paginação: 10 registros por página                   │
│  - Máximo 200 registros por consulta                    │
│  - Ícone de ação por linha                              │
│  - Click no ícone → Detalhe do registro                 │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Fluxo Detalhado por Etapa

#### Etapa 1: Seleção de Arquivo
1. Sistema busca todos os registros da tabela `importados`
2. Exibe em formato de lista/card com informações do arquivo
3. Usuário seleciona um arquivo
4. Sistema armazena `id_importado` no contexto global (state)
5. Todas as queries subsequentes incluem `WHERE id_importado = ?`

#### Etapa 2: Configuração do Mapa
1. Sistema busca geometria da área de atuação: `SELECT geometry FROM arat WHERE id_importado = ?`
2. Calcula o bounding box (bbox) da geometria retornada
3. Mapeia centraliza no bbox e ajusta zoom automaticamente
4. Sistema busca dados iniciais de `ssdmt` e `ssdbt` dentro do bbox
5. Desenha os layers iniciais no mapa

#### Etapa 3: Painel de Layers
1. Sistema busca metadados de `entgeo`: `SELECT nome_tabela, sigla FROM entgeo`
2. Exibe lista de layers com checkbox (ON/OFF)
3. Layers `ssdmt` e `ssdbt` vêm habilitados por padrão
4. Ao habilitar um layer, sistema busca dados da tabela correspondente com `id_importado`
5. Ao desabilitar, remove o layer do mapa sem nova consulta ao banco

#### Etapa 4: Painel de Tabelas
1. Sistema busca metadados de `entab`: `SELECT nome_tabela, nome_tabela_exibicao FROM entab`
2. Exibe lista de tabelas disponíveis para consulta
3. Ao selecionar uma tabela, abre tela de consulta tabular

#### Etapa 5: Consulta Tabular
1. Sistema monta query dinâmica: `SELECT * FROM <tabela> WHERE id_importado = ? LIMIT 200`
2. Exibe primeira página com 10 registros
3. Paginação no frontend (dos 200 registros recuperados)
4. Ícone de ação em cada linha
5. Click no ícone abre modal/tela com detalhes completos do registro

---

## 4. Especificação das Telas

### 4.1 Tela 1: Seleção de Arquivo

#### Layout
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│     🔌 Sistema de Gestão de Rede Elétrica - BDGD       │
│                                                         │
│     Selecione o arquivo BDGD para visualização:         │
│                                                         │
│     ┌───────────────────────────────────────────────┐   │
│     │ 📁 EMG_6585_2020-12-31_M10_20240327-1817     │   │
│     │    Distribuidora: EMG (Energisa MG)           │   │
│     │    Referência: 31/12/2020 | Modelo: M10       │   │
│     │    Importado em: 27/03/2024                   │   │
│     │                              [  Selecionar ] │   │
│     └───────────────────────────────────────────────┘   │
│                                                         │
│     ┌───────────────────────────────────────────────┐   │
│     │ 📁 CPFL_6476_2023-12-31_M10_20240115-0930    │   │
│     │    Distribuidora: CPFL (CPFL Paulista)        │   │
│     │    Referência: 31/12/2023 | Modelo: M10       │   │
│     │    Importado em: 15/01/2024                   │   │
│     │                              [  Selecionar ] │   │
│     └───────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Dados Exibidos
| Campo | Fonte | Descrição |
|-------|-------|-----------|
| nome_arquivo | importados.nome_arquivo | Nome do arquivo GDB original |
| Distribuidora | importados.distribuidora | Código + nome da distribuidora |
| Referência | importados.data_referencia | Data de referência dos dados |
| Modelo | importados.versao_modelo | Versão do modelo BDGD |
| Importado em | importados.data_importacao | Data que foi importado no banco |

#### API
```
GET /api/importados
Retorna: lista de todos os arquivos importados
```

---

### 4.2 Tela 2: Mapa Principal

#### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  Header: EMG_6585_2020-12-31 | Distribuidora: EMG               │
├────────────┬────────────────────────────────────────────────────┤
│            │                                                    │
│  LAYERS    │                                                    │
│  ──────    │           MAPA (MapLibre GL)                       │
│  ☑ SSDMT  │                                                    │
│  ☑ SSDBT  │     ┌─── Área de Atuação ───┐                     │
│  ☐ SEGCON │     │                       │                     │
│  ☐ UNSEMT │     │   ● ● Subestações     │    [+] zoom in      │
│  ☐ UCBT   │     │   ─── Circuitos       │    [-] zoom out     │
│  ☐ CTMT   │     │   ○ Consumidores      │    [⊞] fullscreen   │
│  ☐ ...    │     │                       │    [⊕] minha loc.   │
│            │     └───────────────────────┘                     │
│  ──────    │                                                    │
│  TABELAS   │                                                    │
│  ──────    │                                                    │
│  📋 Tipo   │                                                    │
│  de Cabo   │                                                    │
│  📋 Forma  │                                                    │
│  de Cabo   │                                                    │
│  📋 ...    │                                                    │
│            │                                                    │
└────────────┴────────────────────────────────────────────────────┘
```

#### Painel de Layers (esquerda - superior)
- Lista de layers vem da tabela `entgeo` (campo `sigla`)
- Cada layer tem um checkbox
- `ssdmt` e `ssdbt` habilitados por padrão
- Cor de cada layer definida por tipo de geometria ou por configuração

#### Painel de Tabelas (esquerda - inferior)
- Lista de tabelas vem da tabela `entab` (campo `nome_tabela_exibicao`)
- Click em uma tabela abre a Tela 3 (consulta tabular)

#### Interações no Mapa
| Interação | Comportamento |
|-----------|---------------|
| Zoom in/out | Botões + scroll mouse |
| Pan (arrastar) | Click + drag |
| Click em feature | Popup com dados do registro |
| Hover em feature | Destaque visual |
| Fullscreen | Botão para expandir mapa |
| Identificar layer | Click → mostra qual layer foi clicado |
| Centralizar área | Automático na abertura (bbox de arat) |

#### APIs
```
GET /api/arat/{id_importado}
→ Retorna geometry da área de atuação (para bbox)

GET /api/geo/{nome_tabela}?id_importado={id}&bbox={xmin,ymin,xmax,ymax}
→ Retorna GeoJSON da tabela geográfica dentro do bbox

GET /api/entgeo
→ Retorna lista de entidades geográficas (layers disponíveis)

GET /api/entab
→ Retorna lista de entidades tabulares
```

---

### 4.3 Tela 3: Consulta Tabular

#### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Voltar ao Mapa          Consulta: Tipos de Cabo - Bitola    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Total de registros: 200 | Página 1 de 20                       │
│                                                                 │
│  ┌────┬────────────┬─────────────┬────────────────┬───────┐    │
│  │ # │ cod_id     │ descr       │ campo_3        │  Ação │    │
│  ├────┼────────────┼─────────────┼────────────────┼───────┤    │
│  │  1 │ CAB-001    │ Cabo XLPE   │ ...            │  👁️   │    │
│  │  2 │ CAB-002    │ Cabo PVC    │ ...            │  👁️   │    │
│  │  3 │ CAB-003    │ Cabo Silicone│ ...           │  👁️   │    │
│  │ ..│ ...        │ ...         │ ...            │  ...  │    │
│  │ 10 │ CAB-010    │ ...         │ ...            │  👁️   │    │
│  └────┴────────────┴─────────────┴────────────────┴───────┘    │
│                                                                 │
│  [◀ Anterior]  [1] [2] [3] ... [20]  [Próximo ▶]              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Click no ícone de ação (👁️) → Modal de Detalhes
```
┌──────────────────────────────────────────────┐
│  Detalhes do Registro                   [✕]  │
│  ──────────────────────────────────────────  │
│                                              │
│  cod_id:        CAB-001                      │
│  descr:         Cabo XLPE 4x70mm            │
│  campo_3:       valor                        │
│  campo_4:       valor                        │
│  campo_5:       valor                        │
│  ...                                         │
│                                              │
│  [  Fechar  ]                                │
└──────────────────────────────────────────────┘
```

#### Regras de Paginação
| Regra | Valor |
|-------|-------|
| Registros por página (frontend) | 10 |
| Máximo de registros por consulta (backend) | 200 |
| Total de páginas máximo | 20 (200 ÷ 10) |
| Query SQL | `SELECT * FROM tabela WHERE id_importado = ? LIMIT 200` |

#### API
```
GET /api/tabular/{nome_tabela}?id_importado={id}&limit=200
→ Retorna até 200 registros da tabela
→ Paginação feita no frontend (10 por página)
```

---

## 5. Especificação das APIs (Backend - FastAPI)

### 5.1 Resumo dos Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/importados` | Lista arquivos importados |
| GET | `/api/entgeo` | Lista entidades geográficas |
| GET | `/api/entab` | Lista entidades tabulares |
| GET | `/api/arat/{id_importado}` | Área de atuação (bbox) |
| GET | `/api/geo/{tabela}` | Dados geográficos (GeoJSON) |
| GET | `/api/tabular/{tabela}` | Dados tabulares |
| GET | `/api/registro/{tabela}/{cod_id}` | Detalhes de um registro |

### 5.2 Detalhes dos Endpoints

#### GET /api/importados
```python
# Sem parâmetros
# Retorna todos os arquivos importados

# Response
{
    "importados": [
        {
            "id_importado": 1,
            "nome_arquivo": "EMG_6585_2020-12-31_M10_20240327-1817",
            "distribuidora": "EMG",
            "codigo_aneel": 6585,
            "data_referencia": "2020-12-31",
            "versao_modelo": 10,
            "timestamp_geracao": "2024-03-27T18:17:00",
            "data_importacao": "2024-03-27T19:00:00"
        }
    ]
}
```

#### GET /api/entgeo
```python
# Sem parâmetros
# Retorna lista de entidades geográficas (layers disponíveis)

# Response
{
    "entidades": [
        {
            "nome_tabela": "ssdmt",
            "sigla": "SSDMT - Subestações MT",
            "tipo_geom": "POINT",
            "descricao": "Subestações de Distribuição - Média Tensão"
        },
        {
            "nome_tabela": "ssdbt",
            "sigla": "SSDBT - Subestações BT",
            "tipo_geom": "POINT",
            "descricao": "Subestações de Distribuição - Baixa Tensão"
        }
    ]
}
```

#### GET /api/entab
```python
# Sem parâmetros
# Retorna lista de entidades tabulares

# Response
{
    "entidades": [
        {
            "nome_tabela": "tcabobit",
            "nome_tabela_exibicao": "Tipos de Cabo - Bitola",
            "descricao": "Tabela de bitolas de cabos"
        }
    ]
}
```

#### GET /api/arat/{id_importado}
```python
# Path: id_importado (integer)
# Retorna bbox da área de atuação

# Response
{
    "id_importado": 1,
    "bbox": {
        "xmin": -46.75,
        "ymin": -23.20,
        "xmax": -46.60,
        "ymax": -23.05
    },
    "geojson": {
        "type": "Feature",
        "geometry": { ... },
        "properties": { ... }
    }
}
```

#### GET /api/geo/{tabela}
```python
# Path: tabela (nome da tabela geográfica)
# Query params:
#   id_importado (obrigatório)
#   bbox (opcional): "xmin,ymin,xmax,ymax"
#   limit (opcional): máximo 1000, default 500

# Response (GeoJSON)
{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [-46.65, -23.10]
            },
            "properties": {
                "cod_id": "SSD-001",
                "campo1": "valor1",
                "campo2": "valor2"
            }
        }
    ]
}
```

#### GET /api/tabular/{tabela}
```python
# Path: tabela (nome da tabela não-geográfica)
# Query params:
#   id_importado (obrigatório)
#   limit (opcional): máximo 200, default 200

# Response
{
    "tabela": "tcabobit",
    "total": 45,
    "registros": [
        {
            "cod_id": "CAB-001",
            "descr": "Cabo XLPE 4x70mm",
            "campo3": "valor"
        }
    ]
}
```

#### GET /api/registro/{tabela}/{cod_id}
```python
# Path: tabela, cod_id
# Query params: id_importado (obrigatório)
# Retorna todos os campos de um único registro

# Response
{
    "tabela": "tcabobit",
    "registro": {
        "cod_id": "CAB-001",
        "campo1": "valor1",
        "campo2": "valor2",
        "campo3": "valor3"
    }
}
```

### 5.3 Implementação das APIs

```python
# app/api/bdgd.py

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text
from typing import Optional
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

router = APIRouter(prefix="/api", tags=["BDGD"])

# ============================================
# TABELAS PERMITIDAS (segurança)
# ============================================
# Evita SQL injection ao usar nome da tabela como parâmetro
# Populada dinamicamente a partir de entgeo + entab

TABELAS_GEO_PERMITIDAS = set()   # Populada no startup
TABELAS_TAB_PERMITIDAS = set()   # Populada no startup


async def carregar_tabelas_permitidas(db: AsyncSession):
    """Carrega nomes de tabelas permitidas no startup"""
    
    # Entidades geográficas
    result = await db.execute(text("SELECT nome_tabela FROM entgeo"))
    TABELAS_GEO_PERMITIDAS.update(row[0] for row in result)
    
    # Entidades tabulares
    result = await db.execute(text("SELECT nome_tabela FROM entab"))
    TABELAS_TAB_PERMITIDAS.update(row[0] for row in result)


# ============================================
# ENDPOINTS
# ============================================

@router.get("/importados")
async def listar_importados(db: AsyncSession = Depends(get_db)):
    """Lista todos os arquivos importados"""
    result = await db.execute(text('''
        SELECT 
            id_importado,
            nome_arquivo,
            distribuidora,
            codigo_aneel,
            data_referencia,
            versao_modelo,
            timestamp_geracao,
            data_importacao
        FROM importados
        ORDER BY data_importacao DESC
    '''))
    
    return {"importados": [dict(row._mapping) for row in result]}


@router.get("/entgeo")
async def listar_entidades_geo(db: AsyncSession = Depends(get_db)):
    """Lista entidades geográficas (layers do mapa)"""
    result = await db.execute(text('''
        SELECT nome_tabela, sigla, tipo_geom, descricao
        FROM entgeo
        ORDER BY sigla
    '''))
    
    return {"entidades": [dict(row._mapping) for row in result]}


@router.get("/entab")
async def listar_entidades_tab(db: AsyncSession = Depends(get_db)):
    """Lista entidades tabulares"""
    result = await db.execute(text('''
        SELECT nome_tabela, nome_tabela_exibicao, descricao
        FROM entab
        ORDER BY nome_tabela_exibicao
    '''))
    
    return {"entidades": [dict(row._mapping) for row in result]}


@router.get("/arat/{id_importado}")
async def obter_area_atuacao(
    id_importado: int,
    db: AsyncSession = Depends(get_db)
):
    """Retorna área de atuação e bbox para centralizar mapa"""
    result = await db.execute(text('''
        SELECT 
            ST_AsGeoJSON(geometry)::json as geojson,
            ST_XMin(ST_Extent(geometry)) as xmin,
            ST_YMin(ST_Extent(geometry)) as ymin,
            ST_XMax(ST_Extent(geometry)) as xmax,
            ST_YMax(ST_Extent(geometry)) as ymax
        FROM arat
        WHERE id_importado = :id_importado
    '''), {"id_importado": id_importado})
    
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "Área de atuação não encontrada")
    
    return {
        "id_importado": id_importado,
        "bbox": {
            "xmin": float(row.xmin),
            "ymin": float(row.ymin),
            "xmax": float(row.xmax),
            "ymax": float(row.ymax)
        },
        "geojson": row.geojson
    }


@router.get("/geo/{tabela}")
async def obter_dados_geograficos(
    tabela: str,
    id_importado: int = Query(..., description="ID do arquivo importado"),
    bbox: Optional[str] = Query(None, description="xmin,ymin,xmax,ymax"),
    limit: int = Query(500, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """Retorna dados geográficos de uma tabela como GeoJSON"""
    
    # Validar tabela permitida
    if tabela not in TABELAS_GEO_PERMITIDAS:
        raise HTTPException(400, f"Tabela '{tabela}' não permitida")
    
    # Montar query
    params = {"id_importado": id_importado, "limit": limit}
    
    where_clauses = ["id_importado = :id_importado"]
    
    if bbox:
        coords = [float(x) for x in bbox.split(',')]
        where_clauses.append('''
            ST_Intersects(
                geometry,
                ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
            )
        ''')
        params.update({
            "xmin": coords[0], "ymin": coords[1],
            "xmax": coords[2], "ymax": coords[3]
        })
    
    query = f'''
        SELECT 
            ST_AsGeoJSON(geometry)::json as geometry,
            cod_id,
            *
        FROM {tabela}
        WHERE {' AND '.join(where_clauses)}
        LIMIT :limit
    '''
    
    result = await db.execute(text(query), params)
    rows = result.fetchall()
    
    # Montar GeoJSON
    features = []
    for row in rows:
        row_dict = dict(row._mapping)
        geom = row_dict.pop('geometry', None)
        row_dict.pop('id_importado', None)  # Não expor
        
        features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": row_dict
        })
    
    return {
        "type": "FeatureCollection",
        "features": features
    }


@router.get("/tabular/{tabela}")
async def obter_dados_tabulares(
    tabela: str,
    id_importado: int = Query(..., description="ID do arquivo importado"),
    limit: int = Query(200, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """Retorna dados tabulares (sem geometria)"""
    
    # Validar tabela permitida
    if tabela not in TABELAS_TAB_PERMITIDAS:
        raise HTTPException(400, f"Tabela '{tabela}' não permitida")
    
    # Total de registros
    result_count = await db.execute(
        text(f"SELECT COUNT(*) as total FROM {tabela} WHERE id_importado = :id"),
        {"id": id_importado}
    )
    total = result_count.scalar()
    
    # Buscar registros
    result = await db.execute(
        text(f"SELECT * FROM {tabela} WHERE id_importado = :id LIMIT :limit"),
        {"id": id_importado, "limit": limit}
    )
    rows = result.fetchall()
    
    # Remover id_importado da resposta e geometry se existir
    registros = []
    for row in rows:
        row_dict = dict(row._mapping)
        row_dict.pop('id_importado', None)
        row_dict.pop('geometry', None)
        registros.append(row_dict)
    
    return {
        "tabela": tabela,
        "total": total,
        "total_recuperados": len(registros),
        "registros": registros
    }


@router.get("/registro/{tabela}/{cod_id}")
async def obter_registro(
    tabela: str,
    cod_id: str,
    id_importado: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Retorna detalhes completos de um registro"""
    
    # Validar tabela
    if tabela not in (TABELAS_GEO_PERMITIDAS | TABELAS_TAB_PERMITIDAS):
        raise HTTPException(400, f"Tabela '{tabela}' não permitida")
    
    result = await db.execute(
        text(f'''
            SELECT * FROM {tabela} 
            WHERE id_importado = :id AND cod_id = :cod_id
        '''),
        {"id": id_importado, "cod_id": cod_id}
    )
    
    row = result.fetchone()
    if not row:
        raise HTTPException(404, "Registro não encontrado")
    
    registro = dict(row._mapping)
    registro.pop('id_importado', None)
    
    # Se tiver geometria, converter para GeoJSON
    if 'geometry' in registro and registro['geometry']:
        result_geom = await db.execute(
            text(f'''
                SELECT ST_AsGeoJSON(geometry)::json as geojson
                FROM {tabela}
                WHERE id_importado = :id AND cod_id = :cod_id
            '''),
            {"id": id_importado, "cod_id": cod_id}
        )
        geom_row = result_geom.fetchone()
        registro['geometry'] = geom_row.geojson if geom_row else None
    
    return {"tabela": tabela, "registro": registro}
```

---

## 6. Especificação do Frontend (React)

### 6.1 Estrutura de Componentes

```
frontend/src/
├── App.jsx                     # Rota principal
├── context/
│   └── BDGDContext.jsx         # Contexto global (id_importado, estado)
├── pages/
│   ├── SelecionArquivo.jsx     # Tela 1: Seleção de arquivo
│   ├── MapaPrincipal.jsx       # Tela 2: Mapa com layers
│   └── ConsultaTabular.jsx     # Tela 3: Consulta tabular
├── components/
│   ├── PainelLayers.jsx        # Painel de layers (checkbox)
│   ├── PainelTabelas.jsx       # Painel de tabelas (lista)
│   ├── TabelaPaginada.jsx      # Componente de tabela com paginação
│   ├── ModalDetalhes.jsx       # Modal com detalhes do registro
│   └── MapaControles.jsx       # Controles do mapa (zoom, etc)
├── services/
│   └── api.js                  # Chamadas à API backend
└── utils/
    └── cores.js                # Cores dos layers por tipo
```

### 6.2 Contexto Global (BDGDContext)

```javascript
// context/BDGDContext.jsx
// Armazena o estado global da aplicação

{
    id_importado: null,           // ID do arquivo selecionado
    arquivo_selecionado: null,    // Dados completos do arquivo
    entidades_geo: [],            // Lista de layers (entgeo)
    entidades_tab: [],            // Lista de tabelas (entab)
    area_atuacao: null,           // GeoJSON da área (arat)
    bbox: null,                   // Bbox da área de atuação
    layers_ativos: ['ssdmt', 'ssdbt']  // Layers habilitados por padrão
}
```

### 6.3 Mapa - Controles e Interações

```
Controles Padrão (MapLibre GL):
├── Zoom In (+)
├── Zoom Out (-)
├── Centralizar na Área de Atuação (🏠)
├── Fullscreen (⛶)
└── Escala (barra de escala)

Controles Customizados:
├── Identificar Layer (🎯) - Click → mostra qual layer foi ativado
├── Limpa Seleção (✕)
└── Info do Mapa (ℹ️) - Coordenadas do cursor
```

### 6.4 Estilização dos Layers

```javascript
// utils/cores.js
// Define cores e estilos para cada tipo de layer

const ESTILOS_LAYER = {
    // Points
    POINT: {
        'circle-radius': 6,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFFFFF'
    },
    
    // Lines
    LINESTRING: {
        'line-width': 2
    },
    
    // Polygons
    POLYGON: {
        'fill-opacity': 0.3,
        'fill-outline-color': '#000000'
    },
    
    // Cores por tabela
    CORES: {
        ssdmt:  '#E74C3C',  // Vermelho
        ssdbt:  '#3498DB',  // Azul
        segcon: '#2ECC71',  // Verde
        unsemt: '#F39C12',  // Laranja
        unsebt: '#9B59B6',  // Roxo
        ucbt:   '#1ABC9C',  // Turquesa
        ucmt:   '#E67E22',  // Laranja escuro
        ctmt:   '#D35400',  // Marrom
        ctbt:   '#16A085',  // Verde escuro
        arat:   '#ECF0F1'   // Cinza claro (área)
    }
};
```

---

## 7. Banco de Dados - Queries

### 7.1 Queries Utilizadas na Fase 1

```sql
-- 1. Listar arquivos importados
SELECT * FROM importados ORDER BY data_importacao DESC;

-- 2. Área de atuação (bbox)
SELECT 
    ST_AsGeoJSON(geometry)::json as geojson,
    ST_XMin(ST_Extent(geometry)) as xmin,
    ST_YMin(ST_Extent(geometry)) as ymin,
    ST_XMax(ST_Extent(geometry)) as xmax,
    ST_YMax(ST_Extent(geometry)) as ymax
FROM arat
WHERE id_importado = :id_importado;

-- 3. Dados geográficos com bbox
SELECT *, ST_AsGeoJSON(geometry)::json as geojson
FROM <tabela>
WHERE id_importado = :id_importado
  AND ST_Intersects(geometry, ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326))
LIMIT :limit;

-- 4. Dados tabulares
SELECT * FROM <tabela>
WHERE id_importado = :id_importado
LIMIT 200;

-- 5. Detalhes de registro
SELECT * FROM <tabela>
WHERE id_importado = :id_importado AND cod_id = :cod_id;

-- 6. Lista de layers disponíveis
SELECT nome_tabela, sigla, tipo_geom FROM entgeo;

-- 7. Lista de tabelas disponíveis
SELECT nome_tabela, nome_tabela_exibicao FROM entab;
```

### 7.2 Índices Necessários

```sql
-- Índices por id_importado (particionamento)
-- Criados automaticamente com particionamento LIST

-- Índices espaciais (obrigatório para queries com bbox)
CREATE INDEX idx_<tabela>_geom ON <tabela> USING GIST(geometry);

-- Índices em cod_id (para busca de registro individual)
CREATE INDEX idx_<tabela>_cod_id ON <tabela>(cod_id);

-- Índice composto (id_importado + cod_id) para busca de detalhes
CREATE INDEX idx_<tabela>_imp_cod ON <tabela>(id_importado, cod_id);
```

---

## 8. Docker Compose - Fase 1

```yaml
version: '3.8'

services:
  # PostgreSQL + PostGIS (banco teste)
  postgres:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_DB: rede_eletrica_teste
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  # Backend FastAPI
  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:postgres@postgres:5432/rede_eletrica_teste
    ports:
      - "8000:8000"
    depends_on:
      - postgres
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

volumes:
  postgres_data:
```

---

## 9. Critérios de Aceitação

| ID | Critério | Verificação |
|----|----------|-------------|
| AC-01 | Sistema exibe lista de arquivos importados na abertura | Tela de seleção aparece com dados da tabela importados |
| AC-02 | Seleção de arquivo captura id_importado correto | Todas as queries subsequentes usam o id_importado selecionado |
| AC-03 | Mapa centraliza na área de atuação após seleção | Bbox da tabela arat é calculado e aplicado ao mapa |
| AC-04 | Layers ssdmt e ssdbt são desenhados automaticamente | Dados dessas tabelas são carregados e exibidos no mapa |
| AC-05 | Painel de layers exibe dados da tabela entgeo | Lista de layers usa campo sigla da tabela entgeo |
| AC-06 | Layers podem ser habilitados/desabilitados | Checkbox funciona e dados são carregados/removidos |
| AC-07 | Painel de tabelas exibe dados da tabela entab | Lista usa campo nome_tabela_exibicao da tabela entab |
| AC-08 | Seleção de tabela abre tela de consulta tabular | Tela exibe registros da tabela selecionada |
| AC-09 | Tabela exibe máximo 10 registros por página | Paginação funciona corretamente |
| AC-10 | Máximo 200 registros são recuperados do banco | Query usa LIMIT 200 |
| AC-11 | Ícone de ação abre detalhes do registro | Modal/tela exibe todos os campos do registro |
| AC-12 | Mapa possui zoom, pan e identificação de layers | Controles funcionam corretamente |
| AC-13 | Click em feature no mapa exibe popup com dados | Dados do registro são exibidos no popup |

---

## 10. Cronograma Estimado - Fase 1

```
Semana 1: Setup ambiente + banco teste
├── Docker Compose
├── Verificar dados importados
└── Criar índices necessários

Semana 2: Backend - APIs
├── Endpoints: importados, entgeo, entab
├── Endpoint: arat (bbox)
└── Endpoints: geo, tabular, registro

Semana 3: Frontend - Telas base
├── Tela de seleção de arquivo
├── Contexto global (BDGDContext)
└── Layout da tela principal

Semana 4: Frontend - Mapa
├── Integração MapLibre GL
├── Camada base + área de atuação
└── Layers iniciais (ssdmt, ssdbt)

Semana 5: Frontend - Painéis + Tabular
├── Painel de layers (checkbox)
├── Painel de tabelas
└── Tela de consulta tabular + paginação

Semana 6: Testes + Ajustes
├── Testes funcionais
├── Ajustes de performance
└── Revisão final
```

---

**Documento gerado em**: Fevereiro 2026  
**Status**: Pendente aprovação  
**Próximo passo**: Validar estrutura das tabelas entgeo, entab e arat no banco teste
