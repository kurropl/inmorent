"""
Celery tasks for background scraping + analysis pipeline.
"""
import asyncio
import logging
from celery import Celery
from app.config import settings

logger = logging.getLogger(__name__)

celery_app = Celery(
    "proptech",
    broker=settings.redis_url,
    backend=settings.redis_url,
)
celery_app.conf.task_serializer = "json"
celery_app.conf.result_expires = 3600


@celery_app.task(bind=True, max_retries=2)
def run_scraping(self, portal: str, provincia: str, max_pages: int = 3):
    """
    Celery task: scrape portal, persist results, run analysis pipeline.
    Returns dict with counts.
    """
    return asyncio.run(_scraping_pipeline(portal, provincia, max_pages))


async def _scraping_pipeline(portal: str, provincia: str, max_pages: int) -> dict:
    from app.services.scraper_engine import get_scraper
    from app.services.habitability_check import check_habitability
    from app.services.roi_calculator import calculate_roi, calculate_viability_score
    from app.services.gemini_analyzer import analyze_description
    from app.db import get_pool

    scraper = get_scraper(portal)
    raw_listings = await scraper.search({"provincia": provincia, "max_pages": max_pages})

    pool = await get_pool()
    saved = 0
    analyzed = 0

    for listing in raw_listings:
        try:
            municipio_id = await _resolve_municipio(pool, listing.get("direccion", ""), provincia)

            local_id = await _upsert_local(pool, listing, municipio_id)
            if not local_id:
                continue
            saved += 1

            gemini_result = await analyze_description(listing.get("descripcion_raw"))

            enhanced_desc = (listing.get("descripcion_raw") or "") + " " + " ".join(
                gemini_result.get("keywords_relevantes", [])
            )
            apto, motivos = check_habitability(
                listing.get("superficie_m2"),
                listing.get("altura_techo") or gemini_result.get("altura_estimada"),
                enhanced_desc,
            )

            precio = listing.get("precio") or 0
            superficie = listing.get("superficie_m2") or 1
            precio_m2_ref = await _get_precio_m2(pool, municipio_id)

            coste_total, roi_pct = calculate_roi(precio, superficie, precio_m2_ref)

            distancia_playa = await _estimate_distance_playa(pool, municipio_id)
            moratoria = await _get_moratoria(pool, municipio_id)

            estado = gemini_result.get("estado_conservacion", "desconocido")
            puntuacion, uso = calculate_viability_score(
                roi_pct, apto, distancia_playa, estado, moratoria
            )

            await _upsert_analisis(pool, {
                "local_id": local_id,
                "apto_habitabilidad": apto,
                "motivo_rechazo": motivos,
                "coste_total": coste_total,
                "roi_pct": roi_pct,
                "puntuacion_viabilidad": puntuacion,
                "distancia_playa_m": distancia_playa,
                "keywords_ia": gemini_result,
                "uso_recomendado": uso,
            })
            analyzed += 1

        except Exception as exc:
            logger.error("Error processing listing %s: %s", listing.get("url_origen"), exc)

    return {"portal": portal, "provincia": provincia, "saved": saved, "analyzed": analyzed}


async def _resolve_municipio(pool, direccion: str, provincia: str):
    row = await pool.fetchrow(
        "SELECT id FROM municipios WHERE provincia ILIKE $1 LIMIT 1",
        provincia
    )
    return row["id"] if row else None


async def _upsert_local(pool, listing: dict, municipio_id):
    row = await pool.fetchrow(
        """
        INSERT INTO locales (url_origen, portal, titulo, precio, superficie_m2, descripcion_raw, direccion, imagen_url, municipio_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (url_origen) DO UPDATE SET
            titulo = EXCLUDED.titulo,
            precio = EXCLUDED.precio,
            fecha_scraping = NOW()
        RETURNING id
        """,
        listing.get("url_origen"), listing.get("portal"), listing.get("titulo"),
        listing.get("precio"), listing.get("superficie_m2"), listing.get("descripcion_raw"),
        listing.get("direccion"), listing.get("imagen_url"), municipio_id,
    )
    return row["id"] if row else None


async def _upsert_analisis(pool, data: dict):
    import json as _json
    await pool.execute(
        """
        INSERT INTO analisis_viabilidad
            (local_id, apto_habitabilidad, motivo_rechazo, coste_total, roi_pct,
             puntuacion_viabilidad, distancia_playa_m, keywords_ia, uso_recomendado)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (local_id) DO UPDATE SET
            apto_habitabilidad = EXCLUDED.apto_habitabilidad,
            motivo_rechazo = EXCLUDED.motivo_rechazo,
            coste_total = EXCLUDED.coste_total,
            roi_pct = EXCLUDED.roi_pct,
            puntuacion_viabilidad = EXCLUDED.puntuacion_viabilidad,
            distancia_playa_m = EXCLUDED.distancia_playa_m,
            keywords_ia = EXCLUDED.keywords_ia,
            uso_recomendado = EXCLUDED.uso_recomendado
        """,
        data["local_id"], data["apto_habitabilidad"], data["motivo_rechazo"],
        data["coste_total"], data["roi_pct"], data["puntuacion_viabilidad"],
        data["distancia_playa_m"], _json.dumps(data["keywords_ia"]), data["uso_recomendado"],
    )


async def _get_precio_m2(pool, municipio_id) -> float:
    if not municipio_id:
        return 1500.0
    row = await pool.fetchrow(
        "SELECT precio_m2_vivienda_ref FROM municipios WHERE id = $1", municipio_id
    )
    return float(row["precio_m2_vivienda_ref"]) if row and row["precio_m2_vivienda_ref"] else 1500.0


async def _estimate_distance_playa(pool, municipio_id):
    if not municipio_id:
        return None
    row = await pool.fetchrow(
        "SELECT moratoria_turistica FROM municipios WHERE id = $1", municipio_id
    )
    if row and not row["moratoria_turistica"]:
        return 400
    return 5000


async def _get_moratoria(pool, municipio_id) -> bool:
    if not municipio_id:
        return False
    row = await pool.fetchrow(
        "SELECT moratoria_turistica FROM municipios WHERE id = $1", municipio_id
    )
    return bool(row["moratoria_turistica"]) if row else False
