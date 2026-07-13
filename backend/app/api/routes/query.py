import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.db.supabase import StorageRepository
from app.services.llm_service import LLMService
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()
storage_repo = StorageRepository()

class QueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = None
    min_score: Optional[float] = None
    document_id: Optional[str] = None
    system_prompt: Optional[str] = None

class CitationItem(BaseModel):
    index: int
    document_name: str
    page: int
    text: str
    score: float

class QueryResponse(BaseModel):
    answer: str
    citations: List[CitationItem]
    provider: str
    model: str
    latency_ms: int
    error: Optional[str] = None

@router.post("/query", response_model=QueryResponse, summary="Thực hiện hỏi đáp RAG với tài liệu đã nạp")
@router.post("/chat", response_model=QueryResponse, summary="Endpoint hỏi đáp (bí danh của /query)")
async def execute_rag_query(request: QueryRequest):
    if not request.query or not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Câu hỏi (query) không được để trống."
        )

    top_k = request.top_k or settings.RETRIEVAL_TOP_K
    min_score = request.min_score if request.min_score is not None else settings.RETRIEVAL_MIN_SCORE

    try:
        # Bước 1: Tìm kiếm vector trong kho tài liệu
        search_results = storage_repo.search(
            query_text=request.query,
            top_k=top_k,
            min_score=min_score
        )

        # Nếu có chỉ định lọc theo document_id
        if request.document_id:
            search_results = [
                res for res in search_results
                if res.get("document_id") == request.document_id or res.get("file_name") == request.document_id
            ]

        # Bước 2: Gọi dịch vụ AI để tổng hợp câu trả lời
        result = await LLMService.generate_grounded_answer(
            query=request.query,
            chunks=search_results,
            system_prompt=request.system_prompt
        )

        return QueryResponse(
            answer=result["answer"],
            citations=[CitationItem(**c) for c in result["citations"]],
            provider=result["provider"],
            model=result["model"],
            latency_ms=result["latency_ms"],
            error=result.get("error")
        )

    except Exception as e:
        logger.error(f"Lỗi thực hiện truy vấn RAG: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi xử lý câu hỏi: {str(e)}"
        )
