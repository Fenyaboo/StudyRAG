from fastapi import APIRouter
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
    Check backend readiness, including database and vector store connectivity.
    """
    documents = storage_repo.list_documents()
    ready_documents = [document for document in documents if document.get("status") == "ready"]
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
            "document_count": len(documents),
            "ready_document_count": len(ready_documents),
            "retrieval_mode": "lexical_jsonl",
        },
    )
