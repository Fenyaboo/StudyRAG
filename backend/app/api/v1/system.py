from fastapi import APIRouter, Request

from app.schemas.system import DependencyStatus, HealthResponse, ReadyResponse
from app.services.readiness import evaluate_readiness

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@router.get("/ready", response_model=ReadyResponse)
async def ready(request: Request) -> ReadyResponse:
    snapshot = await evaluate_readiness(request.app.state)
    checks = DependencyStatus(
        database=snapshot.database,
        storage_configured=snapshot.storage_configured,
        storage_reachable=snapshot.storage_reachable,
        dify_configured=snapshot.dify_configured,
        embedding_configured=snapshot.embedding_configured,
    )
    return ReadyResponse(
        status="ready" if snapshot.ready else "not_ready",
        checks=checks,
        ai_enabled=snapshot.ai_enabled,
        message=None if snapshot.ready else "Một hoặc nhiều dependency chưa sẵn sàng hoặc chưa được cấu hình",
    )
