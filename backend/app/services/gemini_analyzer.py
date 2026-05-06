"""
Analyzes property descriptions using Gemini 1.5 Pro.
Returns structured JSON with habitability indicators.
Silently skips if GEMINI_API_KEY is not set.
"""
import json
import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)

DEFAULT_RESULT = {
    "tiene_ventilacion_exterior": None,
    "altura_estimada": None,
    "estado_conservacion": "desconocido",
    "keywords_relevantes": [],
    "riesgos_detectados": [],
}

PROMPT_TEMPLATE = """Analiza esta descripción de un local comercial en España y extrae información relevante para evaluar su conversión a vivienda.

Descripción:
{descripcion}

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin explicaciones) con esta estructura exacta:
{{
  "tiene_ventilacion_exterior": <true|false|null>,
  "altura_estimada": <número float en metros o null>,
  "estado_conservacion": <"bueno"|"regular"|"malo"|"desconocido">,
  "keywords_relevantes": ["lista", "de", "keywords"],
  "riesgos_detectados": ["lista", "de", "riesgos"]
}}

Keywords a buscar: esquina, escaparate, salida de humos, proindiviso, bajera, fachada, patio, entreplanta, semisótano, planta baja, diáfano, reformado, llave en mano.
Riesgos a detectar: proindiviso, ocupado, sin cédula, embargo, herencia, aluminosis, ruido excesivo."""


async def analyze_description(descripcion_raw: Optional[str]) -> dict:
    """
    Returns Gemini analysis dict. Falls back to DEFAULT_RESULT on any error.
    """
    if not settings.gemini_api_key or not descripcion_raw:
        return DEFAULT_RESULT.copy()

    try:
        import google.generativeai as genai
        import asyncio

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-1.5-pro")
        prompt = PROMPT_TEMPLATE.format(descripcion=descripcion_raw[:3000])

        loop = asyncio.get_event_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(None, lambda: model.generate_content(prompt)),
            timeout=10.0,
        )

        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)

    except asyncio.TimeoutError:
        logger.warning("Gemini API timeout for description analysis")
        return DEFAULT_RESULT.copy()
    except Exception as exc:
        logger.warning("Gemini analysis failed: %s", exc)
        return DEFAULT_RESULT.copy()
