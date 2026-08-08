from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response

from app.api.deps import CurrentUser, PoolDep
from app.db.repositories.conversation_repo import ConversationRepository
from app.schemas.conversation import (
    ConversationListResponse,
    ConversationOut,
    ConversationRenameRequest,
    MessageListResponse,
    MessageOut,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _conversation(record: dict[str, Any]) -> ConversationOut:
    return ConversationOut.model_validate(record)


def _message(record: dict[str, Any]) -> MessageOut:
    citations = record.get("citations") or []
    return MessageOut.model_validate({**record, "citations": citations})


@router.get("", response_model=ConversationListResponse)
async def list_conversations(
    current_user: CurrentUser,
    pool: PoolDep,
    limit: int = 50,
    offset: int = 0,
) -> ConversationListResponse:
    records, total = await ConversationRepository(pool).list(
        current_user.id,
        limit=max(1, min(limit, 100)),
        offset=max(offset, 0),
    )
    return ConversationListResponse(items=[_conversation(record) for record in records], total=total)


@router.get("/{conversation_id}/messages", response_model=MessageListResponse)
async def list_messages(conversation_id: UUID, current_user: CurrentUser, pool: PoolDep) -> MessageListResponse:
    repository = ConversationRepository(pool)
    if not await repository.get(current_user.id, conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    records = await repository.list_messages(current_user.id, conversation_id)
    return MessageListResponse(items=[_message(record) for record in records], total=len(records))


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def rename_conversation(
    conversation_id: UUID,
    payload: ConversationRenameRequest,
    current_user: CurrentUser,
    pool: PoolDep,
) -> ConversationOut:
    record = await ConversationRepository(pool).rename(current_user.id, conversation_id, payload.title.strip())
    if not record:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return _conversation(record)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(conversation_id: UUID, current_user: CurrentUser, pool: PoolDep) -> Response:
    deleted = await ConversationRepository(pool).delete(current_user.id, conversation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
