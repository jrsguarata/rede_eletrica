from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Set
from app.database import get_db
from app.auth import get_current_user

router = APIRouter(prefix="/api", tags=["BDGD"])

# Tabelas permitidas (segurança contra SQL injection)
TABELAS_GEO_PERMITIDAS: Set[str] = set()
TABELAS_TAB_PERMITIDAS: Set[str] = set()


async def carregar_tabelas_permitidas(db: AsyncSession):
    """Carrega nomes de tabelas permitidas no startup"""
    global TABELAS_GEO_PERMITIDAS, TABELAS_TAB_PERMITIDAS

    # Entidades geográficas
    result = await db.execute(text("SELECT sigla FROM entgeo"))
    TABELAS_GEO_PERMITIDAS = {row[0] for row in result}

    # Entidades tabulares
    result = await db.execute(text("SELECT sigla FROM enttab"))
    TABELAS_TAB_PERMITIDAS = {row[0] for row in result}


# ============================================
# ENDPOINTS
# ============================================

@router.get("/importados")
async def listar_importados(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    """Lista todos os arquivos BDGD importados"""
    result = await db.execute(text("""
        SELECT
            id_importado,
            nome
        FROM importados
        ORDER BY id_importado DESC
    """))

    importados = []
    for row in result:
        importados.append({
            "id_importado": row[0],
            "nome": row[1]
        })

    return {"importados": importados}


@router.get("/entgeo")
async def listar_entidades_geo(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    """Lista entidades geográficas (layers do mapa)"""
    result = await db.execute(text("""
        SELECT nome, sigla, tipo_de_feicao, descricao
        FROM entgeo
        ORDER BY nome
    """))

    entidades = []
    for row in result:
        entidades.append({
            "nome": row[0],
            "sigla": row[1],
            "tipo_geom": row[2],
            "descricao": row[3]
        })

    return {"entidades": entidades}


@router.get("/enttab")
async def listar_entidades_tab(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    """Lista entidades tabulares (sem geometria)"""
    result = await db.execute(text("""
        SELECT nome, sigla, descricao
        FROM enttab
        ORDER BY nome
    """))

    entidades = []
    for row in result:
        entidades.append({
            "nome": row[0],
            "sigla": row[1],
            "descricao": row[2]
        })

    return {"entidades": entidades}


@router.get("/arat/{id_importado}")
async def obter_area_atuacao(
    id_importado: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Retorna área de atuação e bbox para centralizar mapa"""
    result = await db.execute(text("""
        SELECT
            ST_AsGeoJSON(geom)::json as geojson,
            ST_XMin(ST_Extent(geom)) as xmin,
            ST_YMin(ST_Extent(geom)) as ymin,
            ST_XMax(ST_Extent(geom)) as xmax,
            ST_YMax(ST_Extent(geom)) as ymax
        FROM arat
        WHERE id_importado = :id_importado
        GROUP BY geom
        LIMIT 1
    """), {"id_importado": id_importado})

    row = result.fetchone()
    if not row:
        raise HTTPException(404, "Área de atuação não encontrada")

    return {
        "id_importado": id_importado,
        "bbox": [
            float(row[1]),  # xmin
            float(row[2]),  # ymin
            float(row[3]),  # xmax
            float(row[4])   # ymax
        ],
        "geojson": {
            "type": "Feature",
            "geometry": row[0],
            "properties": {"id_importado": id_importado}
        }
    }


@router.get("/tabular/{tabela}")
async def obter_dados_tabulares(
    tabela: str,
    id_importado: int = Query(..., description="ID do arquivo importado"),
    limit: int = Query(200, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Retorna dados tabulares (sem geometria)"""

    # Recarregar tabelas permitidas se estiver vazio
    if not TABELAS_TAB_PERMITIDAS and not TABELAS_GEO_PERMITIDAS:
        await carregar_tabelas_permitidas(db)

    # Validar tabela permitida
    todas_tabelas = TABELAS_TAB_PERMITIDAS | TABELAS_GEO_PERMITIDAS
    if tabela not in todas_tabelas:
        raise HTTPException(400, f"Tabela '{tabela}' não permitida")

    # Total de registros
    result_count = await db.execute(
        text(f"SELECT COUNT(*) FROM {tabela} WHERE id_importado = :id"),
        {"id": id_importado}
    )
    total = result_count.scalar()

    # Buscar registros
    result = await db.execute(
        text(f"SELECT * FROM {tabela} WHERE id_importado = :id LIMIT :limit OFFSET :offset"),
        {"id": id_importado, "limit": limit, "offset": offset}
    )

    # Obter nomes das colunas
    columns = result.keys()
    rows = result.fetchall()

    # Converter para lista de dicionários, removendo campos internos
    registros = []
    for row in rows:
        row_dict = dict(zip(columns, row))
        row_dict.pop('id_importado', None)
        row_dict.pop('geom', None)
        registros.append(row_dict)

    return {
        "tabela": tabela,
        "total": total,
        "limit": limit,
        "offset": offset,
        "registros": registros
    }


@router.get("/registro/{tabela}/{cod_id}")
async def obter_registro(
    tabela: str,
    cod_id: str,
    id_importado: int = Query(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Retorna detalhes completos de um registro"""

    # Recarregar tabelas permitidas se estiver vazio
    if not TABELAS_TAB_PERMITIDAS and not TABELAS_GEO_PERMITIDAS:
        await carregar_tabelas_permitidas(db)

    # Validar tabela
    todas_tabelas = TABELAS_GEO_PERMITIDAS | TABELAS_TAB_PERMITIDAS
    if tabela not in todas_tabelas:
        raise HTTPException(400, f"Tabela '{tabela}' não permitida")

    result = await db.execute(
        text(f"""
            SELECT * FROM {tabela}
            WHERE id_importado = :id AND cod_id = :cod_id
        """),
        {"id": id_importado, "cod_id": cod_id}
    )

    columns = result.keys()
    row = result.fetchone()

    if not row:
        raise HTTPException(404, "Registro não encontrado")

    registro = dict(zip(columns, row))
    registro.pop('id_importado', None)

    # Se tiver geometria, converter para GeoJSON
    if 'geom' in registro and registro['geom']:
        result_geom = await db.execute(
            text(f"""
                SELECT ST_AsGeoJSON(geom)::json as geojson
                FROM {tabela}
                WHERE id_importado = :id AND cod_id = :cod_id
            """),
            {"id": id_importado, "cod_id": cod_id}
        )
        geom_row = result_geom.fetchone()
        registro['geom'] = geom_row[0] if geom_row else None

    return {"tabela": tabela, "registro": registro}


@router.get("/tiles-config/{id_importado}")
async def obter_config_tiles(
    id_importado: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """
    Retorna configuração das camadas para pg_tileserv
    Usado pelo frontend para montar as URLs dos tiles
    """
    result = await db.execute(text("""
        SELECT sigla, nome, tipo_de_feicao
        FROM entgeo
        ORDER BY nome
    """))

    layers = []
    for row in result:
        sigla = row[0]
        layers.append({
            "id": sigla,
            "nome": row[1],
            "tipo_geom": row[2],
            # URL do tile - pg_tileserv usa função para filtrar por id_importado
            "tile_url": f"/public.{sigla}/{{z}}/{{x}}/{{y}}.pbf?id_importado={id_importado}"
        })

    return {"id_importado": id_importado, "layers": layers}


@router.get("/metadados/{tabela}")
async def obter_metadados_tabela(
    tabela: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """
    Retorna metadados dos campos de uma tabela (descrições dos campos)
    Usado para exibir tooltips com descrição ao passar o mouse sobre os campos
    """
    result = await db.execute(text("""
        SELECT campo, descricao, tipo, obrigatorio
        FROM metadados_tabelas
        WHERE tabela = :tabela
        ORDER BY seq
    """), {"tabela": tabela})

    metadados = {}
    for row in result:
        campo = row[0]
        metadados[campo] = {
            "descricao": row[1] or "",
            "tipo": row[2] or "",
            "obrigatorio": row[3] == "Sim" if row[3] else False
        }

    return {"tabela": tabela, "campos": metadados}
