from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class ChunkMetadata(BaseModel):
    chunk_index: int
    page_number: int
    token_count: int
    section_title: Optional[str] = None
    is_exam_question: bool = False
    question_number: Optional[str] = None

class DocumentChunkResponse(BaseModel):
    id: str
    document_id: str
    content: str
    metadata: ChunkMetadata
    score: Optional[float] = None

class DocumentCreate(BaseModel):
    title: str
    filename: str
    file_hash: str # SHA-256
    file_size_bytes: int
    subject: Optional[str] = "Chung"
    doc_type: Optional[str] = "exam" # exam hoặc textbook

class DocumentResponse(BaseModel):
    id: str
    title: str
    filename: str
    file_hash: str
    file_size_bytes: int
    subject: str
    doc_type: str
    status: str # processing, ready, ocr_required, error
    page_count: int = 0
    chunk_count: int = 0
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class IngestStatusResponse(BaseModel):
    document_id: str
    filename: str
    status: str
    page_count: int
    chunk_count: int
    storage_engine: str # supabase_pgvector hoặc sqlite_chroma
    message: str
