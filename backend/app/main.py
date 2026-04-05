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
