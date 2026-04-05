"""
ROI calculator for commercial-to-residential conversion.
Formula: coste_total = precio_compra + ITP + notaría + reforma
         roi_pct = (precio_mercado - coste_total) / coste_total * 100
"""
from typing import Optional
from app.config import settings


def calculate_roi(
    precio_compra: float,
    superficie_m2: float,
    precio_m2_mercado: float,
) -> tuple[float, float]:
    """
    Returns (coste_total, roi_pct).
    Uses settings for ITP, notaría, reforma defaults.
    """
    coste_reforma = superficie_m2 * settings.coste_reforma_m2
    itp = precio_compra * settings.itp_rate
    coste_total = precio_compra + itp + settings.honorarios_notaria + coste_reforma

    precio_mercado = precio_m2_mercado * superficie_m2
    margen = precio_mercado - coste_total
    roi_pct = (margen / coste_total) * 100 if coste_total > 0 else 0.0

    return round(coste_total, 2), round(roi_pct, 2)


def score_from_roi(roi_pct: float) -> int:
    """Returns 0-40 points based on ROI percentage."""
    if roi_pct >= 30:
        return 40
    elif roi_pct >= 20:
        return 30
    elif roi_pct >= 10:
        return 20
    return 10


def score_from_distance(distancia_m: Optional[int]) -> int:
    """Returns 0-20 points based on distance to beach."""
    if distancia_m is None:
        return 5
    if distancia_m < 500:
        return 20
    elif distancia_m < 1000:
        return 15
    elif distancia_m <= 3000:
        return 10
    return 5


def calculate_viability_score(
    roi_pct: float,
    apto_habitabilidad: bool,
    distancia_playa_m: Optional[int],
    estado_conservacion: str,
    moratoria_turistica: bool,
) -> tuple[int, str]:
    """
    Returns (puntuacion 0-100, uso_recomendado).
    """
    score = 0

    # ROI (40%)
    score += score_from_roi(roi_pct)

    # Habitabilidad (30%)
    if apto_habitabilidad:
        score += 30

    # Ubicación playa (20%)
    score += score_from_distance(distancia_playa_m)

    # Estado del local (10%)
    if estado_conservacion in ("bueno",):
        score += 10
    elif estado_conservacion == "regular":
        score += 5

    # Bonus turístico
    dist = distancia_playa_m or 9999
    if not moratoria_turistica and dist < 1000:
        score = min(100, score + 15)

    # Uso recomendado
    if not apto_habitabilidad:
        uso = "no_viable"
    elif not moratoria_turistica and dist < 1000:
        uso = "turistico" if score >= 70 else "ambos"
    elif score >= 60:
        uso = "segunda_vivienda"
    elif score >= 40:
        uso = "ambos"
    else:
        uso = "no_viable"

    return min(100, score), uso
