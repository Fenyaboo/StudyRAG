from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.chat import Citation


class ConversationOut(BaseModel):
    id: UUID
    title: str
    document_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    last_message_at: datetime


class ConversationListResponse(BaseModel):
    items: list[ConversationOut]
    total: int


class MessageOut(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    citations: list[Citation] = Field(default_factory=list)
    latency_ms: int | None = None
    created_at: datetime


class MessageListResponse(BaseModel):
    items: list[MessageOut]
    total: int


class ConversationRenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
