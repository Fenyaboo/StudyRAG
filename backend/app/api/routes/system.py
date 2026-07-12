from fastapi import APIRouter
from datetime import datetime, timezone
from app.schemas.system import HealthResponse, ReadyResponse
from app.core.config import settings

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
    Check backend readiness, including database and vector store connectivity.
    """
    # Trong Milestone 0, chúng ta trả về ready basic state
    # Khi sang Milestone 1 & 2 sẽ kiểm tra kết nối SQLite & ChromaDB thật
    return ReadyResponse(
        status="ready",
        database="sqlite_ready",
        vector_store="chromadb_ready",
        embedding_provider=settings.EMBEDDING_PROVIDER,
        llm_provider=settings.LLM_PROVIDER,
        details={
            "retrieval_top_k": settings.RETRIEVAL_TOP_K,
            "max_upload_mb": settings.MAX_UPLOAD_MB
        }
    )
