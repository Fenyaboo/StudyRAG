from fastapi import APIRouter
from fastapi.responses import JSONResponse
from datetime import datetime, timezone
from app.schemas.system import HealthResponse, ReadyResponse
from app.core.config import settings
from app.db.supabase import storage_repo

router = APIRouter(tags=["system"])

@router.get("/health", response_model=HealthResponse)
async def get_health():
    """
    Check backend API basic health status.
    """
    return HealthResponse(
        status="ok",
        version="2.0.0",
        environment=settings.APP_ENV,
        timestamp=datetime.now(timezone.utc).isoformat()
    )

@router.get("/ready", response_model=ReadyResponse)
async def get_ready():
    """
    Check backend configuration readiness without accessing private documents.
    """
    if storage_repo.is_postgres and not storage_repo.is_ready:
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "database": "postgres_unready",
                "vector_store": "unavailable",
                "embedding_provider": settings.EMBEDDING_PROVIDER,
                "llm_provider": settings.LLM_PROVIDER,
                "details": {
                    "database_error": storage_repo.readiness_error,
                    "migration": "supabase/migrations/20260713_auth_private_library.sql",
                },
            },
        )

    storage_label = "postgres_ready" if storage_repo.is_postgres else "jsonl_ready"

    return ReadyResponse(
        status="ready",
        database=storage_label,
        vector_store="lexical_retrieval_ready",
        embedding_provider=settings.EMBEDDING_PROVIDER,
        llm_provider=settings.LLM_PROVIDER,
        details={
            "retrieval_top_k": settings.RETRIEVAL_TOP_K,
            "max_upload_mb": settings.MAX_UPLOAD_MB,
            "retrieval_mode": "lexical_postgres" if storage_repo.is_postgres else "lexical_jsonl",
        },
    )
