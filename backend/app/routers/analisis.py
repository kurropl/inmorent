from fastapi import APIRouter, HTTPException, Query
from app.tasks.scraping_tasks import run_scraping, celery_app
from app.models.schemas import ScrapingTaskResponse, TaskStatusResponse
from celery.result import AsyncResult
from typing import Any

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

    if result.failed():
        return TaskStatusResponse(
            task_id=task_id,
            status="failed",
            error=str(result.result),
        )

    return TaskStatusResponse(
        task_id=task_id,
        status=result.status.lower(),
        result=result.result if result.successful() else None,
    )
