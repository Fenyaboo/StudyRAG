import json
import logging
import time
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.api.deps import CurrentUser, PoolDep
from app.core.exceptions import AppError
from app.db.repositories.conversation_repo import ConversationRepository
from app.db.repositories.document_repo import DocumentRepository
from app.schemas.chat import ChatDone, ChatRequest, Citation
from app.services.dify import DifyError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def _citation_payload(index: int, chunk: Any) -> dict[str, Any]:
    page = chunk.metadata.get("page") or chunk.metadata.get("page_start")
    return Citation(
        index=index,
        document_id=chunk.document_id,
        document_name=chunk.document_name,
        page=int(page) if page is not None else None,
        text=chunk.content[:1000],
        score=round(max(0.0, min(1.0, chunk.score)), 4),
    ).model_dump(mode="json")


def _build_context(chunks: list[Any], citations: list[dict[str, Any]]) -> str:
    blocks: list[str] = []
    for citation, chunk in zip(citations, chunks, strict=True):
        page = citation.get("page")
        location = f"trang {page}" if page else "không rõ trang"
        blocks.append(
            f"[{citation['index']}] {citation['document_name']} ({location})\n{chunk.content}"
        )
    return "\n\n---\n\n".join(blocks)


@router.post("", response_class=StreamingResponse)
async def chat(
    payload: ChatRequest,
    request: Request,
    current_user: CurrentUser,
    pool: PoolDep,
) -> StreamingResponse:
    limiter = request.app.state.rate_limiter
    if not limiter.allow(str(current_user.id)):
        raise AppError(429, "Bạn gửi quá nhiều câu hỏi. Vui lòng thử lại sau.", code="rate_limited")

    document_repo = DocumentRepository(pool)
    conversation_repo = ConversationRepository(pool)
    if payload.document_id and not await document_repo.get(current_user.id, payload.document_id):
        raise HTTPException(status_code=404, detail="Document not found")

    conversation: dict[str, Any] | None = None
    if payload.conversation_id:
        conversation = await conversation_repo.get(current_user.id, payload.conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        title = " ".join(payload.query.split())[:54] or "Hội thoại mới"
        conversation = await conversation_repo.create(
            current_user.id,
            document_id=payload.document_id,
            title=title,
        )

    conversation_id = conversation["id"]
    effective_document_id = payload.document_id or conversation.get("document_id")
    user_message = await conversation_repo.add_message(
        current_user.id,
        conversation_id,
        role="user",
        content=payload.query,
    )

    retriever = request.app.state.retriever
    if retriever is None:
        raise AppError(503, "RAG database chưa sẵn sàng", code="rag_unavailable")
    try:
        chunks = await retriever.search(
            current_user.id,
            payload.query,
            document_id=effective_document_id,
        )
    except Exception as exc:
        logger.exception("Retrieval failed", extra={"conversation_id": str(conversation_id)})
        raise AppError(503, "Không thể tìm kiếm tài liệu lúc này", code="retrieval_failed") from exc

    citations = [_citation_payload(index, chunk) for index, chunk in enumerate(chunks, start=1)]
    context = _build_context(chunks, citations)
    dify = request.app.state.dify
    started_at = time.perf_counter()

    async def stream() -> AsyncIterator[str]:
        if not chunks:
            answer = "Mình chưa tìm thấy đoạn thông tin phù hợp trong tài liệu của bạn. Hãy thử nói rõ tên tài liệu, trang hoặc câu hỏi hơn nhé."
            assistant = await conversation_repo.add_message(
                current_user.id,
                conversation_id,
                role="assistant",
                content=answer,
                citations=[],
                latency_ms=int((time.perf_counter() - started_at) * 1000),
            )
            yield _sse("token", {"content": answer})
            done = ChatDone(
                answer=answer,
                citations=[],
                conversation_id=conversation_id,
                message_id=assistant["id"],
                latency_ms=int((time.perf_counter() - started_at) * 1000),
            )
            yield _sse("done", done.model_dump(mode="json"))
            return

        answer_parts: list[str] = []
        dify_message_id: str | None = None
        dify_conversation_id: str | None = conversation.get("dify_conversation_id")
        try:
            async for dify_event in dify.stream_chat(
                query=payload.query,
                context=context,
                user_id=str(current_user.id),
                conversation_id=dify_conversation_id,
            ):
                if dify_event.message_id:
                    dify_message_id = dify_event.message_id
                if dify_event.conversation_id:
                    dify_conversation_id = dify_event.conversation_id
                if dify_event.answer:
                    answer_parts.append(dify_event.answer)
                    yield _sse("token", {"content": dify_event.answer})

            if dify_conversation_id:
                await conversation_repo.set_dify_conversation_id(
                    current_user.id, conversation_id, dify_conversation_id
                )
            answer = "".join(answer_parts).strip()
            if not answer:
                answer = "Dify không trả về nội dung. Vui lòng thử lại câu hỏi này."
            latency_ms = int((time.perf_counter() - started_at) * 1000)
            assistant = await conversation_repo.add_message(
                current_user.id,
                conversation_id,
                role="assistant",
                content=answer,
                citations=citations,
                latency_ms=latency_ms,
                dify_message_id=dify_message_id,
            )
            done = ChatDone(
                answer=answer,
                citations=[Citation.model_validate(citation) for citation in citations],
                conversation_id=conversation_id,
                message_id=assistant["id"],
                latency_ms=latency_ms,
            )
            yield _sse("done", done.model_dump(mode="json"))
        except DifyError as exc:
            logger.warning("Dify streaming failed: %s", exc)
            yield _sse("error", {"code": "dify_error", "message": "AI đang bận, vui lòng thử lại sau."})
        except Exception:
            logger.exception("Chat stream failed", extra={"conversation_id": str(conversation_id)})
            yield _sse("error", {"code": "chat_error", "message": "Không thể hoàn tất câu trả lời."})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Conversation-ID": str(conversation_id),
            "X-User-Message-ID": str(user_message["id"]),
        },
    )
