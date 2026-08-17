import json
import logging
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.api.deps import CurrentUser, PoolDep, require_ai_features
from app.core.exceptions import AppError
from app.db.repositories.conversation_repo import ConversationRepository
from app.db.repositories.document_repo import DocumentRepository
from app.schemas.chat import ChatRequest
from app.services.graph.engine import ExamorasAgentGraph
from app.services.graph.state import GraphState

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/graph",
    tags=["graph"],
    dependencies=[Depends(require_ai_features)],
)


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


@router.post("/chat", response_class=StreamingResponse)
async def graph_chat(
    payload: ChatRequest,
    request: Request,
    current_user: CurrentUser,
    pool: PoolDep,
) -> StreamingResponse:
    """Endpoint chat sử dụng Agentic RAG StateGraph đa bước (Streaming SSE)."""
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
        title = " ".join(payload.query.split())[:54] or "Hội thoại Graph mới"
        conversation = await conversation_repo.create(
            current_user.id,
            document_id=payload.document_id,
            title=title,
        )

    conversation_id = conversation["id"]
    effective_doc_id = payload.document_id or conversation.get("document_id")

    # Ghi message của user
    await conversation_repo.add_message(
        current_user.id,
        conversation_id,
        role="user",
        content=payload.query,
    )

    retriever = getattr(request.app.state, "retriever", None)
    kg_store = getattr(request.app.state, "kg_store", None)
    dify = getattr(request.app.state, "dify", None)

    graph_engine = ExamorasAgentGraph(retriever=retriever, kg_store=kg_store, dify_client=dify)

    initial_state = GraphState(
        query=payload.query,
        owner_id=current_user.id,
        document_id=effective_doc_id,
    )

    async def event_generator() -> AsyncIterator[str]:
        # Gửi init event
        yield _sse(
            "init",
            {
                "conversation_id": str(conversation_id),
                "title": conversation.get("title", "Hội thoại"),
            },
        )

        async for item in graph_engine.stream(initial_state):
            event_type = item.get("event", "message")
            if event_type == "token":
                yield _sse("token", {"delta": item.get("delta", "")})
            elif event_type == "node_complete":
                yield _sse("node_complete", item)
            elif event_type == "done":
                data = item.get("data", {})
                final_answer = data.get("final_answer", "")
                citations = data.get("citations", [])
                trace = data.get("trace", [])

                # Lưu message assistant vào database
                try:
                    msg = await conversation_repo.add_message(
                        current_user.id,
                        conversation_id,
                        role="assistant",
                        content=final_answer,
                        citations=citations,
                    )
                    msg_id = str(msg["id"])
                except Exception:
                    msg_id = str(uuid4())

                yield _sse(
                    "done",
                    {
                        "message_id": msg_id,
                        "conversation_id": str(conversation_id),
                        "citations": citations,
                        "trace": trace,
                        "is_grounded": data.get("is_grounded", True),
                    },
                )

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/knowledge")
async def get_knowledge_graph(
    request: Request,
    current_user: CurrentUser,
    pool: PoolDep,
    subject: str | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
) -> JSONResponse:
    """Lấy danh sách nodes và edges của Knowledge Graph để hiển thị bản đồ tri thức."""
    kg_store = getattr(request.app.state, "kg_store", None)
    if not kg_store:
        return JSONResponse({"nodes": [], "edges": []})

    nodes = list(kg_store._nodes.values())
    if subject and subject != "Chung":
        nodes = [n for n in nodes if n.subject.lower() == subject.lower() or n.subject == "Chung"]

    node_ids = {n.id for n in nodes[:limit]}
    filtered_nodes = [n.model_dump() for n in nodes if n.id in node_ids]
    filtered_edges = [
        e.model_dump()
        for e in kg_store._edges
        if e.source_node_id in node_ids and e.target_node_id in node_ids
    ]

    return JSONResponse({"nodes": filtered_nodes, "edges": filtered_edges})


@router.post("/inspect")
async def inspect_graph_execution(
    payload: ChatRequest,
    request: Request,
    current_user: CurrentUser,
    pool: PoolDep,
) -> JSONResponse:
    """Chạy thử và trả về toàn bộ execution trace của StateGraph cho một câu hỏi."""
    retriever = getattr(request.app.state, "retriever", None)
    kg_store = getattr(request.app.state, "kg_store", None)
    dify = getattr(request.app.state, "dify", None)

    graph_engine = ExamorasAgentGraph(retriever=retriever, kg_store=kg_store, dify_client=dify)

    initial_state = GraphState(
        query=payload.query,
        owner_id=current_user.id,
        document_id=payload.document_id,
    )

    final_state = await graph_engine.run(initial_state)

    return JSONResponse(
        {
            "query": final_state.query,
            "language": final_state.language,
            "subject": final_state.subject,
            "domain_category": final_state.domain_category,
            "intent": final_state.intent,
            "grade_score": final_state.grade_score,
            "retry_count": final_state.retry_count,
            "citations_count": len(final_state.citations),
            "citations": final_state.citations,
            "final_answer": final_state.final_answer,
            "is_grounded": final_state.is_grounded,
            "grounding_score": final_state.grounding_score,
            "trace": final_state.execution_trace,
        }
    )
