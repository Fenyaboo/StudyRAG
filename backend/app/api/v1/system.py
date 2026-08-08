from fastapi import APIRouter, Request

from app.db.connection import check_database
from app.schemas.system import DependencyStatus, HealthResponse, ReadyResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@router.get("/ready", response_model=ReadyResponse)
async def ready(request: Request) -> ReadyResponse:
    settings = request.app.state.settings
    database = await check_database(getattr(request.app.state, "pool", None))
    checks = DependencyStatus(
        database=database,
        storage_configured=request.app.state.storage.configured,
        dify_configured=request.app.state.dify.configured,
        embedding_configured=request.app.state.embedding.configured,
    )
    all_ready = all(checks.model_dump().values())
    return ReadyResponse(
        status="ready" if all_ready else "not_ready",
        checks=checks,
        message=None if all_ready else "Một hoặc nhiều dependency chưa được cấu hình",
    )
