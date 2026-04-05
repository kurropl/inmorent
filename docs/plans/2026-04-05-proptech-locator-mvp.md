# PropTech Locator MVP — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-stack PropTech app that scrapes commercial properties on the Huelva coast, analyzes habitability and ROI, and presents investment opportunities in a dashboard.

**Architecture:** FastAPI async backend with Celery/Redis for background scraping tasks, PostgreSQL+PostGIS for geospatial data, and a Next.js 14 App Router frontend with shadcn/ui. All services orchestrated via Docker Compose with nginx reverse proxy.

**Tech Stack:** Python 3.12, FastAPI, Celery, Redis, PostgreSQL 16 + PostGIS, asyncpg, Playwright, Gemini 1.5 Pro API, Next.js 14, Tailwind CSS, shadcn/ui, Docker Compose, nginx

---

## File Map (complete list of files to create)

```
proptech-locator/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── db.py
│   │   ├── models/
│   │   │   └── schemas.py
│   │   ├── routers/
│   │   │   ├── locales.py
│   │   │   └── analisis.py
│   │   ├── services/
│   │   │   ├── scraper_engine.py
│   │   │   ├── habitability_check.py
│   │   │   ├── roi_calculator.py
│   │   │   └── gemini_analyzer.py
│   │   └── tasks/
│   │       └── scraping_tasks.py
│   └── sql/
│       └── schema.sql
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── src/app/
│       ├── layout.tsx
│       ├── globals.css
│       ├── page.tsx
│       └── components/
│           ├── FilterPanel.tsx
│           ├── OpportunityTable.tsx
│           └── MapView.tsx
└── nginx/
    └── default.conf
```

---

### Task 1: Docker Compose + Infra Files

**Files:**
- Create: `proptech-locator/docker-compose.yml`
- Create: `proptech-locator/.env.example`
- Create: `proptech-locator/nginx/default.conf`

**Step 1: Create docker-compose.yml**

```yaml
version: "3.9"

services:
  db:
    image: postgis/postgis:16-3.4
    restart: unless-stopped
    environment:
      POSTGRES_USER: proptech
      POSTGRES_PASSWORD: proptech
      POSTGRES_DB: proptech
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backend/sql/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U proptech"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  backend:
    build: ./backend
    restart: unless-stopped
    env_file: .env
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000

  worker:
    build: ./backend
    restart: unless-stopped
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    command: celery -A app.tasks.scraping_tasks worker --loglevel=info

  frontend:
    build: ./frontend
    restart: unless-stopped
    env_file: .env
    ports:
      - "3000:3000"
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf
      - certbot_www:/var/www/certbot
      - certbot_conf:/etc/letsencrypt
    depends_on:
      - backend
      - frontend

volumes:
  pgdata:
  certbot_www:
  certbot_conf:
```

**Step 2: Create .env.example**

```env
DATABASE_URL=postgresql://proptech:proptech@db:5432/proptech
REDIS_URL=redis://redis:6379/0
GEMINI_API_KEY=
ITP_RATE=0.07
HONORARIOS_NOTARIA=3000
COSTE_REFORMA_M2=900
SCRAPER_MIN_DELAY=3
SCRAPER_MAX_DELAY=7
CORS_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Step 3: Create nginx/default.conf**

```nginx
upstream backend {
    server backend:8000;
}

upstream frontend {
    server frontend:3000;
}

server {
    listen 80;
    server_name _;

    location /api/ {
        proxy_pass http://backend/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location / {
        proxy_pass http://frontend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
}
```

**Step 4: Commit**
```bash
git add docker-compose.yml .env.example nginx/
git commit -m "feat: docker compose infra + nginx config"
```

---

### Task 2: SQL Schema

**Files:**
- Create: `proptech-locator/backend/sql/schema.sql`

**Step 1: Write schema.sql**

```sql
-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Municipios
CREATE TABLE IF NOT EXISTS municipios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    provincia VARCHAR(50) NOT NULL,
    moratoria_turistica BOOLEAN DEFAULT false,
    precio_m2_vivienda_ref NUMERIC(8,2),
    geom GEOMETRY(POINT, 4326)
);

CREATE INDEX IF NOT EXISTS idx_municipios_geom ON municipios USING GIST (geom);

-- Locales
CREATE TABLE IF NOT EXISTS locales (
    id SERIAL PRIMARY KEY,
    url_origen TEXT UNIQUE NOT NULL,
    portal VARCHAR(50) NOT NULL,
    titulo VARCHAR(300),
    precio NUMERIC(10,2),
    superficie_m2 NUMERIC(6,2),
    altura_techo NUMERIC(3,2),
    descripcion_raw TEXT,
    direccion TEXT,
    municipio_id INTEGER REFERENCES municipios(id),
    imagen_url TEXT,
    geom GEOMETRY(POINT, 4326),
    fecha_scraping TIMESTAMP DEFAULT NOW(),
    activo BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_locales_municipio ON locales(municipio_id);
CREATE INDEX IF NOT EXISTS idx_locales_portal ON locales(portal);
CREATE INDEX IF NOT EXISTS idx_locales_activo ON locales(activo);
CREATE INDEX IF NOT EXISTS idx_locales_geom ON locales USING GIST (geom);

-- Analisis de viabilidad
CREATE TABLE IF NOT EXISTS analisis_viabilidad (
    id SERIAL PRIMARY KEY,
    local_id INTEGER REFERENCES locales(id) UNIQUE,
    apto_habitabilidad BOOLEAN,
    motivo_rechazo TEXT[],
    coste_total NUMERIC(10,2),
    roi_pct NUMERIC(5,2),
    puntuacion_viabilidad INTEGER CHECK (puntuacion_viabilidad BETWEEN 0 AND 100),
    distancia_playa_m INTEGER,
    keywords_ia JSONB,
    uso_recomendado VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analisis_puntuacion ON analisis_viabilidad(puntuacion_viabilidad DESC);

-- Seed municipios costa Huelva + Sevilla + Cádiz
INSERT INTO municipios (nombre, provincia, moratoria_turistica, precio_m2_vivienda_ref, geom) VALUES
  ('Punta Umbría',   'Huelva', false, 1800.00, ST_SetSRID(ST_MakePoint(-6.9603, 37.1817), 4326)),
  ('Islantilla',     'Huelva', false, 1950.00, ST_SetSRID(ST_MakePoint(-7.1833, 37.1500), 4326)),
  ('El Portil',      'Huelva', false, 1750.00, ST_SetSRID(ST_MakePoint(-7.0167, 37.1833), 4326)),
  ('La Antilla',     'Huelva', false, 1700.00, ST_SetSRID(ST_MakePoint(-7.1500, 37.1667), 4326)),
  ('Mazagón',        'Huelva', false, 1600.00, ST_SetSRID(ST_MakePoint(-6.8167, 37.1333), 4326)),
  ('Isla Cristina',  'Huelva', false, 1650.00, ST_SetSRID(ST_MakePoint(-7.3167, 37.2000), 4326)),
  ('Ayamonte',       'Huelva', false, 1550.00, ST_SetSRID(ST_MakePoint(-7.4000, 37.2167), 4326)),
  ('Huelva',         'Huelva', false, 1400.00, ST_SetSRID(ST_MakePoint(-6.9444, 37.2614), 4326)),
  ('Sevilla',        'Sevilla', true,  2800.00, ST_SetSRID(ST_MakePoint(-5.9845, 37.3891), 4326)),
  ('Cádiz',          'Cádiz',   true,  2200.00, ST_SetSRID(ST_MakePoint(-6.2886, 36.5297), 4326))
ON CONFLICT DO NOTHING;
```

**Step 2: Commit**
```bash
git add backend/sql/schema.sql
git commit -m "feat: sql schema with postgis + seed data"
```

---

### Task 3: Backend Dockerfile + requirements.txt

**Files:**
- Create: `proptech-locator/backend/Dockerfile`
- Create: `proptech-locator/backend/requirements.txt`

**Step 1: Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN playwright install chromium --with-deps

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 2: requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
asyncpg==0.29.0
pydantic==2.9.2
pydantic-settings==2.5.2
celery[redis]==5.4.0
redis==5.1.1
playwright==1.47.0
playwright-stealth==1.0.6
google-generativeai==0.8.3
httpx==0.27.2
python-multipart==0.0.9
psycopg2-binary==2.9.9
```

**Step 3: Commit**
```bash
git add backend/Dockerfile backend/requirements.txt
git commit -m "feat: backend dockerfile and dependencies"
```

---

### Task 4: Backend Config + DB

**Files:**
- Create: `proptech-locator/backend/app/config.py`
- Create: `proptech-locator/backend/app/db.py`

**Step 1: config.py**

```python
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    database_url: str = "postgresql://proptech:proptech@db:5432/proptech"
    redis_url: str = "redis://redis:6379/0"
    gemini_api_key: str = ""
    itp_rate: float = 0.07
    honorarios_notaria: float = 3000.0
    coste_reforma_m2: float = 900.0
    scraper_min_delay: int = 3
    scraper_max_delay: int = 7
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
```

**Step 2: db.py**

```python
import asyncpg
from app.config import settings

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        # asyncpg uses postgres:// scheme
        dsn = settings.database_url.replace("postgresql://", "postgres://")
        _pool = await asyncpg.create_pool(dsn, min_size=2, max_size=10)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
```

**Step 3: Commit**
```bash
git add backend/app/config.py backend/app/db.py
git commit -m "feat: backend config + asyncpg pool"
```

---

### Task 5: Pydantic Schemas

**Files:**
- Create: `proptech-locator/backend/app/models/schemas.py`
- Create: `proptech-locator/backend/app/models/__init__.py`

**Step 1: schemas.py**

```python
from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Any
from datetime import datetime


class GeoPoint(BaseModel):
    lat: float
    lon: float


class MunicipioOut(BaseModel):
    id: int
    nombre: str
    provincia: str
    moratoria_turistica: bool
    precio_m2_vivienda_ref: Optional[float]


class LocalBase(BaseModel):
    url_origen: str
    portal: str
    titulo: Optional[str]
    precio: Optional[float]
    superficie_m2: Optional[float]
    altura_techo: Optional[float]
    descripcion_raw: Optional[str]
    direccion: Optional[str]
    imagen_url: Optional[str]


class LocalCreate(LocalBase):
    municipio_id: Optional[int] = None
    lat: Optional[float] = None
    lon: Optional[float] = None


class AnalisisOut(BaseModel):
    id: int
    local_id: int
    apto_habitabilidad: Optional[bool]
    motivo_rechazo: Optional[List[str]]
    coste_total: Optional[float]
    roi_pct: Optional[float]
    puntuacion_viabilidad: Optional[int]
    distancia_playa_m: Optional[int]
    keywords_ia: Optional[Any]
    uso_recomendado: Optional[str]
    created_at: datetime


class LocalOut(BaseModel):
    id: int
    url_origen: str
    portal: str
    titulo: Optional[str]
    precio: Optional[float]
    superficie_m2: Optional[float]
    altura_techo: Optional[float]
    descripcion_raw: Optional[str]
    direccion: Optional[str]
    imagen_url: Optional[str]
    municipio_id: Optional[int]
    fecha_scraping: datetime
    activo: bool
    analisis: Optional[AnalisisOut] = None
    municipio: Optional[MunicipioOut] = None


class LocalListResponse(BaseModel):
    total: int
    page: int
    per_page: int
    items: List[LocalOut]


class StatsOut(BaseModel):
    total_oportunidades: int
    media_roi: Optional[float]
    mejor_puntuacion: Optional[int]
    mejor_local_id: Optional[int]
    distribucion_puntuaciones: dict


class ScrapingTaskResponse(BaseModel):
    task_id: str
    status: str
    message: str


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[Any] = None
    error: Optional[str] = None
```

**Step 2: __init__.py** (empty)

```python
```

**Step 3: Commit**
```bash
git add backend/app/models/
git commit -m "feat: pydantic schemas"
```

---

### Task 6: Habitability Check Service

**Files:**
- Create: `proptech-locator/backend/app/services/habitability_check.py`
- Create: `proptech-locator/backend/app/services/__init__.py`

**Step 1: habitability_check.py**

```python
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
```

**Step 2: Commit**
```bash
git add backend/app/services/
git commit -m "feat: habitability check service"
```

---

### Task 7: ROI Calculator

**Files:**
- Create: `proptech-locator/backend/app/services/roi_calculator.py`

**Step 1: roi_calculator.py**

```python
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
```

**Step 2: Commit**
```bash
git add backend/app/services/roi_calculator.py
git commit -m "feat: roi calculator + viability scoring"
```

---

### Task 8: Gemini Analyzer

**Files:**
- Create: `proptech-locator/backend/app/services/gemini_analyzer.py`

**Step 1: gemini_analyzer.py**

```python
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

        # Run sync SDK call in thread pool
        loop = asyncio.get_event_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(None, lambda: model.generate_content(prompt)),
            timeout=10.0,
        )

        text = response.text.strip()
        # Strip markdown code fences if present
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
```

**Step 2: Commit**
```bash
git add backend/app/services/gemini_analyzer.py
git commit -m "feat: gemini 1.5 pro analyzer service"
```

---

### Task 9: Scraper Engine

**Files:**
- Create: `proptech-locator/backend/app/services/scraper_engine.py`

**Step 1: scraper_engine.py**

```python
"""
Modular scraper engine with BaseScraper + ServihabitatScraper implementation.
Uses Playwright + playwright-stealth with rate limiting and retry logic.
"""
import asyncio
import logging
import random
from abc import ABC, abstractmethod
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
]

CAPTCHA_SIGNALS = [
    "captcha", "robot", "verifica", "cloudflare", "access denied",
    "too many requests", "blocked"
]


class BaseScraper(ABC):
    """Abstract base for all portal scrapers."""

    portal_name: str = ""

    def __init__(self):
        self.results: list[dict] = []

    @abstractmethod
    async def search(self, filters: dict) -> list[dict]:
        """Run a search and return list of raw listing dicts."""
        ...

    @abstractmethod
    async def parse_listing(self, page, url: str) -> Optional[dict]:
        """Parse a single listing page and return dict or None."""
        ...

    async def _delay(self):
        delay = random.uniform(settings.scraper_min_delay, settings.scraper_max_delay)
        await asyncio.sleep(delay)

    def _is_blocked(self, content: str) -> bool:
        lower = content.lower()
        return any(signal in lower for signal in CAPTCHA_SIGNALS)

    async def _get_with_retry(self, page, url: str, max_retries: int = 3) -> Optional[str]:
        """Navigate to URL with exponential backoff retry. Returns page content or None."""
        for attempt in range(max_retries):
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                content = await page.content()
                if self._is_blocked(content):
                    logger.warning("Blocked/captcha detected at %s, skipping", url)
                    return None
                return content
            except Exception as exc:
                wait = 2 ** attempt
                logger.warning("Attempt %d failed for %s: %s. Retrying in %ds", attempt + 1, url, exc, wait)
                await asyncio.sleep(wait)
        return None


class ServihabitatScraper(BaseScraper):
    """
    Scraper for Servihabitat portal (banco-backed, lower anti-bot protection).
    Searches for commercial properties (locales) in given province.
    """

    portal_name = "servihabitat"
    BASE_URL = "https://www.servihabitat.com"
    SEARCH_URL = "https://www.servihabitat.com/inmuebles/locales-comerciales/alquiler-venta"

    async def search(self, filters: dict) -> list[dict]:
        """
        filters: {"provincia": "Huelva", "max_pages": 5}
        Returns list of raw listing dicts.
        """
        from playwright.async_api import async_playwright
        from playwright_stealth import stealth_async

        provincia = filters.get("provincia", "Huelva")
        max_pages = filters.get("max_pages", 3)
        listings = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport={"width": 1366, "height": 768},
            )
            page = await context.new_page()
            await stealth_async(page)

            search_url = f"{self.SEARCH_URL}?provincia={provincia.lower()}"

            for page_num in range(1, max_pages + 1):
                url = f"{search_url}&pagina={page_num}"
                logger.info("Scraping %s page %d: %s", self.portal_name, page_num, url)

                content = await self._get_with_retry(page, url)
                if not content:
                    break

                page_listings = await self._extract_listing_urls(page)
                if not page_listings:
                    logger.info("No more listings on page %d", page_num)
                    break

                for listing_url in page_listings:
                    await self._delay()
                    full_url = listing_url if listing_url.startswith("http") else f"{self.BASE_URL}{listing_url}"
                    listing_page = await context.new_page()
                    await stealth_async(listing_page)
                    try:
                        result = await self.parse_listing(listing_page, full_url)
                        if result:
                            result["portal"] = self.portal_name
                            listings.append(result)
                    finally:
                        await listing_page.close()

            await browser.close()

        logger.info("Servihabitat scraped %d listings", len(listings))
        return listings

    async def _extract_listing_urls(self, page) -> list[str]:
        """Extract listing URLs from search results page."""
        try:
            links = await page.eval_on_selector_all(
                "a[href*='/inmuebles/']",
                "els => els.map(e => e.getAttribute('href'))"
            )
            # Filter to individual listing pages (contain numeric ID)
            return list(set(
                link for link in links
                if link and any(c.isdigit() for c in link) and "locales" in link.lower()
            ))
        except Exception as exc:
            logger.warning("Failed to extract listing URLs: %s", exc)
            return []

    async def parse_listing(self, page, url: str) -> Optional[dict]:
        """Parse a single Servihabitat listing page."""
        content = await self._get_with_retry(page, url)
        if not content:
            return None

        try:
            titulo = await self._safe_text(page, "h1.property-title, h1[class*='title']")
            precio_text = await self._safe_text(page, "[class*='price'], [class*='precio']")
            superficie_text = await self._safe_text(page, "[class*='surface'], [class*='superficie'], [data-label='Superficie']")
            descripcion = await self._safe_text(page, "[class*='description'], [class*='descripcion'], #property-description")
            direccion = await self._safe_text(page, "[class*='address'], [class*='direccion'], [class*='location']")
            imagen_url = await self._safe_attr(page, "img[class*='main'], img[class*='principal'], .property-image img", "src")

            precio = self._parse_number(precio_text)
            superficie = self._parse_number(superficie_text)

            if not titulo and not precio:
                return None

            return {
                "url_origen": url,
                "titulo": titulo,
                "precio": precio,
                "superficie_m2": superficie,
                "descripcion_raw": descripcion,
                "direccion": direccion,
                "imagen_url": imagen_url,
            }
        except Exception as exc:
            logger.warning("Failed to parse listing %s: %s", url, exc)
            return None

    async def _safe_text(self, page, selector: str) -> Optional[str]:
        try:
            el = await page.query_selector(selector)
            if el:
                return (await el.inner_text()).strip() or None
        except Exception:
            pass
        return None

    async def _safe_attr(self, page, selector: str, attr: str) -> Optional[str]:
        try:
            el = await page.query_selector(selector)
            if el:
                return await el.get_attribute(attr)
        except Exception:
            pass
        return None

    def _parse_number(self, text: Optional[str]) -> Optional[float]:
        if not text:
            return None
        import re
        digits = re.sub(r"[^\d,.]", "", text).replace(",", ".")
        try:
            return float(digits)
        except ValueError:
            return None


SCRAPERS = {
    "servihabitat": ServihabitatScraper,
}


def get_scraper(portal: str) -> BaseScraper:
    cls = SCRAPERS.get(portal)
    if not cls:
        raise ValueError(f"Unknown portal: {portal}. Available: {list(SCRAPERS.keys())}")
    return cls()
```

**Step 2: Commit**
```bash
git add backend/app/services/scraper_engine.py
git commit -m "feat: playwright scraper engine with Servihabitat impl"
```

---

### Task 10: Celery Tasks

**Files:**
- Create: `proptech-locator/backend/app/tasks/scraping_tasks.py`
- Create: `proptech-locator/backend/app/tasks/__init__.py`

**Step 1: scraping_tasks.py**

```python
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
            # Resolve municipio_id by matching address/provincia
            municipio_id = await _resolve_municipio(pool, listing.get("direccion", ""), provincia)

            # Insert local (upsert on url_origen)
            local_id = await _upsert_local(pool, listing, municipio_id)
            if not local_id:
                continue
            saved += 1

            # Gemini analysis
            gemini_result = await analyze_description(listing.get("descripcion_raw"))

            # Habitability check (combine description + gemini)
            enhanced_desc = (listing.get("descripcion_raw") or "") + " " + " ".join(
                gemini_result.get("keywords_relevantes", [])
            )
            apto, motivos = check_habitability(
                listing.get("superficie_m2"),
                listing.get("altura_techo") or gemini_result.get("altura_estimada"),
                enhanced_desc,
            )

            # ROI calculation
            precio = listing.get("precio") or 0
            superficie = listing.get("superficie_m2") or 1
            precio_m2_ref = await _get_precio_m2(pool, municipio_id)

            coste_total, roi_pct = calculate_roi(precio, superficie, precio_m2_ref)

            # Distance to beach (use municipio geom as proxy for MVP)
            distancia_playa = await _estimate_distance_playa(pool, municipio_id)
            moratoria = await _get_moratoria(pool, municipio_id)

            estado = gemini_result.get("estado_conservacion", "desconocido")
            puntuacion, uso = calculate_viability_score(
                roi_pct, apto, distancia_playa, estado, moratoria
            )

            # Upsert analisis
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


async def _resolve_municipio(pool, direccion: str, provincia: str) -> int | None:
    row = await pool.fetchrow(
        "SELECT id FROM municipios WHERE provincia ILIKE $1 LIMIT 1",
        provincia
    )
    return row["id"] if row else None


async def _upsert_local(pool, listing: dict, municipio_id) -> int | None:
    import json as _json
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


async def _estimate_distance_playa(pool, municipio_id) -> int | None:
    """For MVP, uses hardcoded estimates per municipio type. Real impl would query geospatial DB."""
    if not municipio_id:
        return None
    row = await pool.fetchrow(
        "SELECT moratoria_turistica FROM municipios WHERE id = $1", municipio_id
    )
    if row and not row["moratoria_turistica"]:
        return 400  # Costa Huelva municipalities assumed near beach
    return 5000


async def _get_moratoria(pool, municipio_id) -> bool:
    if not municipio_id:
        return False
    row = await pool.fetchrow(
        "SELECT moratoria_turistica FROM municipios WHERE id = $1", municipio_id
    )
    return bool(row["moratoria_turistica"]) if row else False
```

**Step 2: Commit**
```bash
git add backend/app/tasks/
git commit -m "feat: celery scraping + analysis pipeline task"
```

---

### Task 11: API Routers

**Files:**
- Create: `proptech-locator/backend/app/routers/locales.py`
- Create: `proptech-locator/backend/app/routers/analisis.py`
- Create: `proptech-locator/backend/app/routers/__init__.py`

**Step 1: routers/locales.py**

```python
from fastapi import APIRouter, Query, HTTPException
from app.db import get_pool
from app.models.schemas import LocalListResponse, LocalOut, StatsOut, AnalisisOut, MunicipioOut
from typing import Optional
import json

router = APIRouter(prefix="/api", tags=["locales"])


@router.get("/locales", response_model=LocalListResponse)
async def list_locales(
    provincia: Optional[str] = Query(None),
    min_score: int = Query(0, ge=0, le=100),
    uso_turistico: bool = Query(False),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    order_by: str = Query("puntuacion", regex="^(puntuacion|precio|precio_m2)$"),
):
    pool = await get_pool()
    offset = (page - 1) * per_page

    conditions = ["l.activo = true"]
    params = []

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
    params = []
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
            WHERE {where} AND av.puntuacion_viabilidad = ${ len(params)+1 }
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
```

**Step 2: routers/analisis.py**

```python
from fastapi import APIRouter, HTTPException, Query
from app.db import get_pool
from app.tasks.scraping_tasks import run_scraping, celery_app
from app.models.schemas import ScrapingTaskResponse, TaskStatusResponse
from celery.result import AsyncResult

router = APIRouter(prefix="/api", tags=["scraping"])


@router.post("/scraping/run", response_model=ScrapingTaskResponse)
async def trigger_scraping(
    portal: str = Query("servihabitat"),
    provincia: str = Query("Huelva"),
    max_pages: int = Query(3, ge=1, le=20),
):
    valid_portals = ["servihabitat"]
    if portal not in valid_portals:
        raise HTTPException(status_code=400, detail=f"Portal must be one of {valid_portals}")

    task = run_scraping.delay(portal, provincia, max_pages)
    return ScrapingTaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Scraping task queued for {portal} / {provincia}",
    )


@router.get("/scraping/status/{task_id}", response_model=TaskStatusResponse)
async def scraping_status(task_id: str):
    result = AsyncResult(task_id, app=celery_app)
    status = result.status.lower()

    if result.failed():
        return TaskStatusResponse(
            task_id=task_id,
            status="failed",
            error=str(result.result),
        )

    return TaskStatusResponse(
        task_id=task_id,
        status=status,
        result=result.result if result.successful() else None,
    )
```

**Step 3: Commit**
```bash
git add backend/app/routers/
git commit -m "feat: API routers for locales, stats, scraping"
```

---

### Task 12: FastAPI main.py

**Files:**
- Create: `proptech-locator/backend/app/main.py`
- Create: `proptech-locator/backend/app/__init__.py`

**Step 1: main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.db import get_pool, close_pool
from app.routers.locales import router as locales_router
from app.routers.analisis import router as analisis_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()


app = FastAPI(
    title="PropTech Locator API",
    description="Detección de oportunidades inmobiliarias en costa de Huelva",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(locales_router)
app.include_router(analisis_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

**Step 2: Commit**
```bash
git add backend/app/main.py backend/app/__init__.py
git commit -m "feat: fastapi app entry point with cors + lifespan"
```

---

### Task 13: Frontend Setup Files

**Files:**
- Create: `proptech-locator/frontend/Dockerfile`
- Create: `proptech-locator/frontend/package.json`
- Create: `proptech-locator/frontend/next.config.js`
- Create: `proptech-locator/frontend/tailwind.config.ts`
- Create: `proptech-locator/frontend/tsconfig.json`

**Step 1: Dockerfile**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

**Step 2: package.json**

```json
{
  "name": "proptech-locator-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.2",
    "lucide-react": "^0.438.0",
    "@radix-ui/react-select": "^2.1.1",
    "@radix-ui/react-checkbox": "^1.1.1",
    "@radix-ui/react-slider": "^1.2.0",
    "@radix-ui/react-dialog": "^1.1.1"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5",
    "tailwindcss": "^3.4.10",
    "postcss": "^8",
    "autoprefixer": "^10"
  }
}
```

**Step 3: next.config.js**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

module.exports = nextConfig;
```

**Step 4: tailwind.config.ts**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        score: {
          high: "#22c55e",
          mid: "#eab308",
          low: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

**Step 5: tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 6: Commit**
```bash
git add frontend/
git commit -m "feat: frontend next.js 14 project setup"
```

---

### Task 14: Frontend Layout + Globals

**Files:**
- Create: `proptech-locator/frontend/src/app/layout.tsx`
- Create: `proptech-locator/frontend/src/app/globals.css`

**Step 1: layout.tsx**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PropTech Locator — Oportunidades Inmobiliarias",
  description: "Detección de locales comerciales convertibles a vivienda en costa de Huelva",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
```

**Step 2: globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}
```

**Step 3: Commit**
```bash
git add frontend/src/app/layout.tsx frontend/src/app/globals.css
git commit -m "feat: frontend layout + global styles"
```

---

### Task 15: FilterPanel Component

**Files:**
- Create: `proptech-locator/frontend/src/app/components/FilterPanel.tsx`

**Step 1: FilterPanel.tsx**

```tsx
"use client";

import { useState } from "react";

export interface Filters {
  provincia: string;
  min_score: number;
  uso_turistico: boolean;
  order_by: "puntuacion" | "precio" | "precio_m2";
}

interface FilterPanelProps {
  onSearch: (filters: Filters) => void;
  loading?: boolean;
}

export default function FilterPanel({ onSearch, loading }: FilterPanelProps) {
  const [provincia, setProvincia] = useState("Huelva");
  const [minScore, setMinScore] = useState(50);
  const [usoTuristico, setUsoTuristico] = useState(false);
  const [orderBy, setOrderBy] = useState<Filters["order_by"]>("puntuacion");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({ provincia, min_score: minScore, uso_turistico: usoTuristico, order_by: orderBy });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-wrap gap-4 items-end"
    >
      {/* Provincia */}
      <div className="flex flex-col gap-1 min-w-[160px]">
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">
          Provincia
        </label>
        <select
          value={provincia}
          onChange={(e) => setProvincia(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
        >
          <option value="Huelva">Huelva</option>
          <option value="Sevilla">Sevilla</option>
          <option value="Cádiz">Cádiz</option>
          <option value="Málaga">Málaga</option>
        </select>
      </div>

      {/* Puntuación mínima */}
      <div className="flex flex-col gap-1 min-w-[200px]">
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">
          Puntuación mínima: <span className="text-blue-400">{minScore}</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          className="accent-blue-500 w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      {/* Ordenar por */}
      <div className="flex flex-col gap-1 min-w-[150px]">
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">
          Ordenar por
        </label>
        <select
          value={orderBy}
          onChange={(e) => setOrderBy(e.target.value as Filters["order_by"])}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
        >
          <option value="puntuacion">Puntuación</option>
          <option value="precio">Precio</option>
          <option value="precio_m2">EUR/m²</option>
        </select>
      </div>

      {/* Checkbox turístico */}
      <div className="flex items-center gap-2 pb-2">
        <input
          id="uso_turistico"
          type="checkbox"
          checked={usoTuristico}
          onChange={(e) => setUsoTuristico(e.target.checked)}
          className="w-4 h-4 accent-blue-500"
        />
        <label htmlFor="uso_turistico" className="text-sm text-gray-300 cursor-pointer">
          Solo uso turístico
        </label>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
      >
        {loading ? "Buscando..." : "Buscar"}
      </button>
    </form>
  );
}
```

**Step 2: Commit**
```bash
git add frontend/src/app/components/FilterPanel.tsx
git commit -m "feat: filter panel component"
```

---

### Task 16: OpportunityTable Component

**Files:**
- Create: `proptech-locator/frontend/src/app/components/OpportunityTable.tsx`

**Step 1: OpportunityTable.tsx**

```tsx
"use client";

import Image from "next/image";
import { ExternalLink } from "lucide-react";

export interface LocalItem {
  id: number;
  url_origen: string;
  titulo: string | null;
  precio: number | null;
  superficie_m2: number | null;
  imagen_url: string | null;
  municipio: { nombre: string; provincia: string } | null;
  analisis: {
    puntuacion_viabilidad: number | null;
    distancia_playa_m: number | null;
    roi_pct: number | null;
    uso_recomendado: string | null;
  } | null;
}

interface OpportunityTableProps {
  items: LocalItem[];
  total: number;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-500">—</span>;
  const color =
    score >= 70
      ? "bg-green-900 text-green-300 border-green-700"
      : score >= 40
      ? "bg-yellow-900 text-yellow-300 border-yellow-700"
      : "bg-red-900 text-red-300 border-red-700";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${color}`}>
      {score}
    </span>
  );
}

function formatEur(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function formatDist(m: number | null): string {
  if (m === null) return "—";
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

const USO_LABELS: Record<string, string> = {
  turistico: "Turístico",
  segunda_vivienda: "2ª Vivienda",
  ambos: "Ambos",
  no_viable: "No viable",
};

export default function OpportunityTable({
  items,
  total,
  page,
  perPage,
  onPageChange,
}: OpportunityTableProps) {
  const totalPages = Math.ceil(total / perPage);

  if (!items.length) {
    return (
      <div className="text-center py-20 text-gray-500">
        No se encontraron oportunidades con los filtros seleccionados.
      </div>
    );
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide">
              <th className="px-3 py-3 text-left w-16">Foto</th>
              <th className="px-3 py-3 text-left">Municipio</th>
              <th className="px-3 py-3 text-right">Precio</th>
              <th className="px-3 py-3 text-right">€/m²</th>
              <th className="px-3 py-3 text-right">m²</th>
              <th className="px-3 py-3 text-center">Puntuación</th>
              <th className="px-3 py-3 text-right">Playa</th>
              <th className="px-3 py-3 text-center">Uso</th>
              <th className="px-3 py-3 text-center">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {items.map((item) => {
              const preciom2 =
                item.precio && item.superficie_m2
                  ? item.precio / item.superficie_m2
                  : null;
              return (
                <tr key={item.id} className="hover:bg-gray-900 transition-colors">
                  <td className="px-3 py-2">
                    {item.imagen_url ? (
                      <img
                        src={item.imagen_url}
                        alt={item.titulo || "local"}
                        className="w-14 h-14 object-cover rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-14 h-14 bg-gray-800 rounded-lg flex items-center justify-center text-gray-600 text-xs">
                        Sin foto
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-100">
                      {item.municipio?.nombre || "—"}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-[180px]">
                      {item.titulo || "Sin título"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-100">{formatEur(item.precio)}</td>
                  <td className="px-3 py-2 text-right text-gray-400">{formatEur(preciom2)}</td>
                  <td className="px-3 py-2 text-right text-gray-300">
                    {item.superficie_m2 ? `${item.superficie_m2} m²` : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <ScoreBadge score={item.analisis?.puntuacion_viabilidad ?? null} />
                  </td>
                  <td className="px-3 py-2 text-right text-gray-400">
                    {formatDist(item.analisis?.distancia_playa_m ?? null)}
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-gray-400">
                    {USO_LABELS[item.analisis?.uso_recomendado || ""] || "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <a
                      href={item.url_origen}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex gap-3">
              {item.imagen_url && (
                <img
                  src={item.imagen_url}
                  alt=""
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{item.municipio?.nombre || "—"}</div>
                    <div className="text-xs text-gray-500 truncate">{item.titulo}</div>
                  </div>
                  <ScoreBadge score={item.analisis?.puntuacion_viabilidad ?? null} />
                </div>
                <div className="mt-2 flex gap-4 text-xs text-gray-400">
                  <span>{formatEur(item.precio)}</span>
                  <span>{item.superficie_m2 ? `${item.superficie_m2} m²` : ""}</span>
                  <span>{formatDist(item.analisis?.distancia_playa_m ?? null)}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-between items-center">
              <span className="text-xs text-gray-500">
                {USO_LABELS[item.analisis?.uso_recomendado || ""] || "—"}
              </span>
              <a href={item.url_origen} target="_blank" rel="noopener noreferrer"
                className="text-blue-400 text-xs flex items-center gap-1">
                Ver anuncio <ExternalLink size={12} />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
          <span>{total} resultados</span>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40"
            >
              ←
            </button>
            <span className="px-3 py-1.5 text-gray-300">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**
```bash
git add frontend/src/app/components/OpportunityTable.tsx
git commit -m "feat: opportunity table + mobile cards component"
```

---

### Task 17: MapView Component

**Files:**
- Create: `proptech-locator/frontend/src/app/components/MapView.tsx`

**Step 1: MapView.tsx**

```tsx
"use client";

// TODO: Implement full Leaflet map for production
// For MVP: placeholder with future implementation notes

export interface MapItem {
  id: number;
  lat: number;
  lon: number;
  titulo: string | null;
  precio: number | null;
  puntuacion: number | null;
  url: string;
}

interface MapViewProps {
  items: MapItem[];
}

export default function MapView({ items }: MapViewProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px] text-center">
      <div className="text-4xl mb-3">🗺️</div>
      <h3 className="text-lg font-semibold text-gray-200 mb-1">Mapa de oportunidades</h3>
      <p className="text-gray-500 text-sm max-w-sm">
        Vista de mapa con Leaflet — próximamente. Se mostrarán {items.length} oportunidades
        con marcadores codificados por puntuación (verde / amarillo / rojo).
      </p>
      <p className="text-xs text-gray-600 mt-3">
        Implementar: npm install leaflet react-leaflet @types/leaflet
      </p>
    </div>
  );
}
```

**Step 2: Commit**
```bash
git add frontend/src/app/components/MapView.tsx
git commit -m "feat: mapview placeholder component"
```

---

### Task 18: Main Dashboard Page

**Files:**
- Create: `proptech-locator/frontend/src/app/page.tsx`

**Step 1: page.tsx**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import FilterPanel, { Filters } from "./components/FilterPanel";
import OpportunityTable, { LocalItem } from "./components/OpportunityTable";
import MapView from "./components/MapView";
import { TrendingUp, Building2, Star, Sun, Moon } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Stats {
  total_oportunidades: number;
  media_roi: number | null;
  mejor_puntuacion: number | null;
  mejor_local_id: number | null;
}

interface ApiResponse {
  total: number;
  page: number;
  per_page: number;
  items: LocalItem[];
}

function StatCard({
  icon,
  label,
  value,
  link,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  link?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
      <div className="text-blue-400 p-2 bg-blue-950 rounded-lg">{icon}</div>
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
        {link ? (
          <a href={link} className="text-xl font-bold text-blue-400 hover:text-blue-300">
            {value}
          </a>
        ) : (
          <div className="text-xl font-bold text-gray-100">{value}</div>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [currentFilters, setCurrentFilters] = useState<Filters>({
    provincia: "Huelva",
    min_score: 50,
    uso_turistico: false,
    order_by: "puntuacion",
  });
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async (filters: Filters, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        provincia: filters.provincia,
        min_score: String(filters.min_score),
        uso_turistico: String(filters.uso_turistico),
        order_by: filters.order_by,
        page: String(p),
        per_page: "20",
      });

      const [localesRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/locales?${params}`),
        fetch(`${API_URL}/api/stats?provincia=${filters.provincia}`),
      ]);

      if (localesRes.ok) setData(await localesRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(currentFilters, page);
  }, []);

  const handleSearch = (filters: Filters) => {
    setCurrentFilters(filters);
    setPage(1);
    fetchData(filters, 1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchData(currentFilters, newPage);
  };

  const toggleDark = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">
              PropTech Locator
            </h1>
            <p className="text-xs text-gray-400">Oportunidades Inmobiliarias — Costa de Huelva</p>
          </div>
          <button
            onClick={toggleDark}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={<Building2 size={20} />}
            label="Total oportunidades"
            value={stats ? String(stats.total_oportunidades) : "—"}
          />
          <StatCard
            icon={<TrendingUp size={20} />}
            label="Media ROI"
            value={stats?.media_roi != null ? `${stats.media_roi.toFixed(1)}%` : "—"}
          />
          <StatCard
            icon={<Star size={20} />}
            label="Mejor oportunidad"
            value={stats?.mejor_puntuacion != null ? `Score ${stats.mejor_puntuacion}` : "—"}
            link={stats?.mejor_local_id ? `/locales/${stats.mejor_local_id}` : undefined}
          />
        </div>

        {/* Filters */}
        <FilterPanel onSearch={handleSearch} loading={loading} />

        {/* Map */}
        <MapView items={[]} />

        {/* Results */}
        {loading ? (
          <div className="text-center py-16 text-gray-500">
            <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p>Cargando oportunidades...</p>
          </div>
        ) : (
          <OpportunityTable
            items={data?.items || []}
            total={data?.total || 0}
            page={page}
            perPage={20}
            onPageChange={handlePageChange}
          />
        )}
      </main>
    </div>
  );
}
```

**Step 2: Commit**
```bash
git add frontend/src/app/page.tsx
git commit -m "feat: main dashboard page with stats + filters + table"
```

---

### Task 19: Final Verification

**Step 1: Verify all files exist**
```bash
find proptech-locator -type f | sort
```

Expected output: all 30+ files listed above.

**Step 2: Copy .env.example to .env and fill in values**
```bash
cp proptech-locator/.env.example proptech-locator/.env
# Edit GEMINI_API_KEY if available
```

**Step 3: Build and start everything**
```bash
cd proptech-locator
docker compose up --build
```

Expected: all 6 services start healthy. Backend accessible at http://localhost:8000/docs, frontend at http://localhost:3000.

**Step 4: Verify backend health**
```bash
curl http://localhost:8000/health
# Expected: {"status":"ok"}
```

**Step 5: Trigger test scrape**
```bash
curl -X POST "http://localhost:8000/api/scraping/run?portal=servihabitat&provincia=Huelva&max_pages=1"
# Expected: {"task_id":"...","status":"queued","message":"..."}
```

**Step 6: Final commit**
```bash
git add .
git commit -m "chore: proptech locator MVP complete"
```

---

## Launch Commands

```bash
# 1. Navigate to project
cd proptech-locator

# 2. Copy and configure env
cp .env.example .env
# Edit .env: add GEMINI_API_KEY if available

# 3. Build and start all services
docker compose up --build

# 4. Services available at:
#   Frontend:  http://localhost:3000
#   API docs:  http://localhost:8000/docs
#   API:       http://localhost:8000/api/
```

## Architecture Notes

- **DB init**: `schema.sql` runs automatically on first `docker compose up` via `docker-entrypoint-initdb.d`
- **Scraping**: Triggered via `POST /api/scraping/run` — runs as Celery background task, non-blocking
- **Gemini**: Optional — silently skipped if `GEMINI_API_KEY` is empty
- **Anti-bot**: Playwright-stealth + UA rotation + random delays + exponential retry
- **Scoring**: Composite 0–100 score; bonus +15 for non-moratoria coastal municipalities
