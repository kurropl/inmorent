from pydantic import BaseModel
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
