"""
Checks habitability compliance per Ley LISTA + CTE Andalucía.
Returns (apto: bool, motivos_rechazo: list[str])
"""
from typing import Optional


KEYWORDS_VENTILACION = [
    "fachada", "ventana exterior", "patio de luces", "ventilación exterior",
    "luz natural", "exterior", "orientación"
]

KEYWORDS_ACCESO_INDEPENDIENTE = [
    "acceso independiente", "entrada independiente", "puerta a calle",
    "entrada directa", "acceso directo"
]


def check_habitability(
    superficie_m2: Optional[float],
    altura_techo: Optional[float],
    descripcion_raw: Optional[str],
) -> tuple[bool, list[str]]:
    """
    Returns (apto, motivos_rechazo).
    motivos_rechazo is empty list when apto=True.
    """
    motivos: list[str] = []
    desc = (descripcion_raw or "").lower()

    # 1. Superficie mínima
    if superficie_m2 is None:
        motivos.append("Superficie desconocida (mínimo 40 m²)")
    elif superficie_m2 < 40:
        motivos.append(f"Superficie {superficie_m2:.1f} m² insuficiente (mínimo 40 m²)")

    # 2. Altura libre mínima
    if altura_techo is not None and altura_techo < 2.50:
        motivos.append(
            f"Altura libre {altura_techo:.2f} m insuficiente (mínimo 2.50 m)"
        )

    # 3. Ventilación exterior (inferida de descripción)
    tiene_ventilacion = any(kw in desc for kw in KEYWORDS_VENTILACION)
    if not tiene_ventilacion and descripcion_raw:
        motivos.append("No se detecta ventilación exterior en descripción")

    # 4. Acceso independiente (inferido de descripción)
    tiene_acceso = any(kw in desc for kw in KEYWORDS_ACCESO_INDEPENDIENTE)
    if not tiene_acceso and descripcion_raw:
        motivos.append("No se detecta acceso independiente en descripción")

    apto = len(motivos) == 0
    return apto, motivos
