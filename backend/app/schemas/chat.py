from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class Citation(BaseModel):
    index: int
    document_id: UUID
    document_name: str
    page: int | None = None
    text: str
    score: float = Field(ge=0, le=1)


class ChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    document_id: UUID | None = None
    conversation_id: UUID | None = None


class ChatDone(BaseModel):
    answer: str
    citations: list[Citation]
    conversation_id: UUID
    message_id: UUID
    latency_ms: int


class ChatError(BaseModel):
    code: str
    message: str


class SSEEvent(BaseModel):
    event: str
    data: dict[str, Any]
