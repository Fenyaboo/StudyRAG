from fastapi import APIRouter, Request

from app.db.connection import check_database
from app.schemas.system import DependencyStatus, HealthResponse, ReadyResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@router.get("/ready", response_model=ReadyResponse)
async def ready(request: Request) -> ReadyResponse:
    database = await check_database(getattr(request.app.state, "pool", None))
    storage = request.app.state.storage
    storage_configured = storage.configured
    # Readiness phải phản ánh khả năng truy cập S3 thật (credentials/quyền), không chỉ
    # việc bucket đã được khai báo. Kết quả được cache ngắn ở StorageService.
    storage_reachable = await storage.check_cached() if storage_configured else False
    checks = DependencyStatus(
        database=database,
        storage_configured=storage_configured,
        storage_reachable=storage_reachable,
        dify_configured=request.app.state.dify.configured,
        embedding_configured=request.app.state.embedding.configured,
    )
    all_ready = all(checks.model_dump().values())
    return ReadyResponse(
        status="ready" if all_ready else "not_ready",
        checks=checks,
        message=None if all_ready else "Một hoặc nhiều dependency chưa sẵn sàng hoặc chưa được cấu hình",
    )
