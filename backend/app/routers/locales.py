from fastapi import APIRouter, Query, HTTPException
from app.db import get_pool
from app.models.schemas import LocalListResponse, LocalOut, StatsOut, AnalisisOut, MunicipioOut
from typing import Optional

router = APIRouter(prefix="/api", tags=["locales"])


@router.get("/locales", response_model=LocalListResponse)
async def list_locales(
    provincia: Optional[str] = Query(None),
    min_score: int = Query(0, ge=0, le=100),
    uso_turistico: bool = Query(False),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    order_by: str = Query("puntuacion", pattern="^(puntuacion|precio|precio_m2)$"),
):
    pool = await get_pool()
    offset = (page - 1) * per_page

    conditions = ["l.activo = true"]
    params: list = []

    if provincia:
        params.append(provincia)
        conditions.append(f"m.provincia ILIKE ${len(params)}")
    if min_score > 0:
        params.append(min_score)
        conditions.append(f"av.puntuacion_viabilidad >= ${len(params)}")
    if uso_turistico:
        conditions.append("av.uso_recomendado IN ('turistico', 'ambos')")

    where_clause = " AND ".join(conditions)

    order_sql = {
        "puntuacion": "av.puntuacion_viabilidad DESC NULLS LAST",
        "precio": "l.precio ASC NULLS LAST",
        "precio_m2": "(l.precio / NULLIF(l.superficie_m2, 0)) ASC NULLS LAST",
    }[order_by]

    query = f"""
        SELECT
            l.id, l.url_origen, l.portal, l.titulo, l.precio, l.superficie_m2,
            l.altura_techo, l.descripcion_raw, l.direccion, l.imagen_url,
            l.municipio_id, l.fecha_scraping, l.activo,
            av.id as av_id, av.apto_habitabilidad, av.motivo_rechazo,
            av.coste_total, av.roi_pct, av.puntuacion_viabilidad,
            av.distancia_playa_m, av.keywords_ia, av.uso_recomendado, av.created_at as av_created_at,
            m.nombre as municipio_nombre, m.provincia as municipio_provincia,
            m.moratoria_turistica, m.precio_m2_vivienda_ref
        FROM locales l
        LEFT JOIN analisis_viabilidad av ON av.local_id = l.id
        LEFT JOIN municipios m ON m.id = l.municipio_id
        WHERE {where_clause}
        ORDER BY {order_sql}
        LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}
    """
    count_query = f"""
        SELECT COUNT(*) FROM locales l
        LEFT JOIN analisis_viabilidad av ON av.local_id = l.id
        LEFT JOIN municipios m ON m.id = l.municipio_id
        WHERE {where_clause}
    """

    rows = await pool.fetch(query, *params, per_page, offset)
    total_row = await pool.fetchrow(count_query, *params)
    total = total_row[0] if total_row else 0

    items = [_row_to_local(r) for r in rows]
    return LocalListResponse(total=total, page=page, per_page=per_page, items=items)


@router.get("/locales/{local_id}", response_model=LocalOut)
async def get_local(local_id: int):
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT l.*, av.id as av_id, av.apto_habitabilidad, av.motivo_rechazo,
               av.coste_total, av.roi_pct, av.puntuacion_viabilidad,
               av.distancia_playa_m, av.keywords_ia, av.uso_recomendado, av.created_at as av_created_at,
               m.nombre as municipio_nombre, m.provincia as municipio_provincia,
               m.moratoria_turistica, m.precio_m2_vivienda_ref
        FROM locales l
        LEFT JOIN analisis_viabilidad av ON av.local_id = l.id
        LEFT JOIN municipios m ON m.id = l.municipio_id
        WHERE l.id = $1
        """,
        local_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Local not found")
    return _row_to_local(row)


@router.get("/stats", response_model=StatsOut)
async def get_stats(provincia: Optional[str] = Query(None)):
    pool = await get_pool()
    params: list = []
    where = "l.activo = true"
    if provincia:
        params.append(provincia)
        where += f" AND m.provincia ILIKE ${len(params)}"

    row = await pool.fetchrow(
        f"""
        SELECT
            COUNT(l.id) as total,
            ROUND(AVG(av.roi_pct)::numeric, 2) as media_roi,
            MAX(av.puntuacion_viabilidad) as mejor_puntuacion
        FROM locales l
        LEFT JOIN analisis_viabilidad av ON av.local_id = l.id
        LEFT JOIN municipios m ON m.id = l.municipio_id
        WHERE {where}
        """,
        *params
    )

    mejor_id = None
    if row and row["mejor_puntuacion"]:
        best = await pool.fetchrow(
            f"""
            SELECT l.id FROM locales l
            JOIN analisis_viabilidad av ON av.local_id = l.id
            LEFT JOIN municipios m ON m.id = l.municipio_id
            WHERE {where} AND av.puntuacion_viabilidad = ${len(params) + 1}
            LIMIT 1
            """,
            *params, row["mejor_puntuacion"]
        )
        mejor_id = best["id"] if best else None

    dist_rows = await pool.fetch(
        f"""
        SELECT
            CASE
                WHEN av.puntuacion_viabilidad >= 70 THEN 'alta'
                WHEN av.puntuacion_viabilidad >= 40 THEN 'media'
                ELSE 'baja'
            END as categoria,
            COUNT(*) as cnt
        FROM locales l
        JOIN analisis_viabilidad av ON av.local_id = l.id
        LEFT JOIN municipios m ON m.id = l.municipio_id
        WHERE {where}
        GROUP BY categoria
        """,
        *params
    )

    distribucion = {r["categoria"]: r["cnt"] for r in dist_rows}

    return StatsOut(
        total_oportunidades=row["total"] if row else 0,
        media_roi=float(row["media_roi"]) if row and row["media_roi"] else None,
        mejor_puntuacion=row["mejor_puntuacion"] if row else None,
        mejor_local_id=mejor_id,
        distribucion_puntuaciones=distribucion,
    )


def _row_to_local(r) -> LocalOut:
    analisis = None
    if r["av_id"]:
        keywords = r["keywords_ia"]
        if isinstance(keywords, str):
            import json as _json
            try:
                keywords = _json.loads(keywords)
            except Exception:
                keywords = None
        analisis = AnalisisOut(
            id=r["av_id"],
            local_id=r["id"],
            apto_habitabilidad=r["apto_habitabilidad"],
            motivo_rechazo=list(r["motivo_rechazo"]) if r["motivo_rechazo"] else [],
            coste_total=float(r["coste_total"]) if r["coste_total"] else None,
            roi_pct=float(r["roi_pct"]) if r["roi_pct"] else None,
            puntuacion_viabilidad=r["puntuacion_viabilidad"],
            distancia_playa_m=r["distancia_playa_m"],
            keywords_ia=keywords,
            uso_recomendado=r["uso_recomendado"],
            created_at=r["av_created_at"],
        )

    municipio = None
    if r.get("municipio_nombre"):
        municipio = MunicipioOut(
            id=r["municipio_id"],
            nombre=r["municipio_nombre"],
            provincia=r["municipio_provincia"],
            moratoria_turistica=r["moratoria_turistica"],
            precio_m2_vivienda_ref=float(r["precio_m2_vivienda_ref"]) if r["precio_m2_vivienda_ref"] else None,
        )

    return LocalOut(
        id=r["id"],
        url_origen=r["url_origen"],
        portal=r["portal"],
        titulo=r["titulo"],
        precio=float(r["precio"]) if r["precio"] else None,
        superficie_m2=float(r["superficie_m2"]) if r["superficie_m2"] else None,
        altura_techo=float(r["altura_techo"]) if r["altura_techo"] else None,
        descripcion_raw=r["descripcion_raw"],
        direccion=r["direccion"],
        imagen_url=r["imagen_url"],
        municipio_id=r["municipio_id"],
        fecha_scraping=r["fecha_scraping"],
        activo=r["activo"],
        analisis=analisis,
        municipio=municipio,
    )
