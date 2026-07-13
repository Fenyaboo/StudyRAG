import logging
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.core.auth import CurrentUser, get_current_user
from app.db.supabase import storage_repo
from app.services.llm_service import LLMService
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

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


def _retrieval_guard_response(answer: str, error_code: str) -> QueryResponse:
    """Return an actionable response without spending a provider call on empty context."""
    return QueryResponse(
        answer=answer,
        citations=[],
        provider="retrieval-guard",
        model="no-llm-call",
        latency_ms=0,
        error=error_code,
    )

@router.post("/query", response_model=QueryResponse, summary="Thực hiện hỏi đáp RAG với tài liệu đã nạp")
@router.post("/chat", response_model=QueryResponse, summary="Endpoint hỏi đáp (bí danh của /query)")
async def execute_rag_query(
    request: QueryRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    if not request.query or not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Câu hỏi (query) không được để trống."
        )

    top_k = request.top_k or settings.RETRIEVAL_TOP_K
    min_score = request.min_score if request.min_score is not None else settings.RETRIEVAL_MIN_SCORE

    try:
        # Do not ask an LLM to answer without a real, ready corpus.
        if not storage_repo.has_ready_documents(current_user.id):
            return _retrieval_guard_response(
                "Kho tài liệu đang trống. Hãy tải ít nhất một file PDF vào Thư viện rồi đặt lại câu hỏi để mình có nguồn kiểm chứng.",
                "NO_DOCUMENTS",
            )

        if request.document_id and not storage_repo.has_ready_documents(current_user.id, request.document_id):
            return _retrieval_guard_response(
                "Tài liệu bạn đã chọn không còn sẵn sàng để tra cứu. Hãy chọn lại một tài liệu trong Thư viện.",
                "DOCUMENT_NOT_AVAILABLE",
            )

        # Bước 1: Tìm chunks liên quan trong kho tài liệu, đã lọc document từ đầu nếu người dùng chọn.
        search_results = storage_repo.search(
            query_text=request.query,
            owner_id=current_user.id,
            top_k=top_k,
            min_score=min_score,
            document_id=request.document_id,
        )

        if not search_results:
            return _retrieval_guard_response(
                "Mình chưa tìm thấy đoạn nào đủ liên quan trong tài liệu để trả lời chắc chắn. Bạn thử nêu rõ trang, câu hoặc chọn đúng tài liệu cần tra cứu nhé.",
                "NO_RELEVANT_CONTEXT",
            )

        # Bước 2: Chỉ gọi AI khi retrieval đã có context có bằng chứng.
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
