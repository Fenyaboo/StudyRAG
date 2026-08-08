from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


DocumentStatus = Literal["processing", "ready", "failed", "ocr_required"]
DocumentType = Literal["exam", "textbook"]
Subject = Literal["Toán", "Lý", "Hóa", "Chung"]


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    filename: str
    file_size_bytes: int
    subject: str
    doc_type: str
    status: DocumentStatus
    page_count: int
    chunk_count: int
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class DocumentListResponse(BaseModel):
    items: list[DocumentOut]
    total: int


class IngestResponse(BaseModel):
    document: DocumentOut
    accepted: bool = True
    message: str = "Tài liệu đã được nhận và đang xử lý"


class PresignedUrlResponse(BaseModel):
    url: str
    expires_in: int


class DocumentFilters(BaseModel):
    subject: str | None = None
    status: DocumentStatus | None = None
    search: str | None = Field(default=None, max_length=100)
