import hashlib
import logging
import re
from pathlib import PurePath
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response

from app.api.deps import CurrentUser, PoolDep, SettingsDep
from app.core.exceptions import AppError
from app.db.repositories.chunk_repo import ChunkRepository
from app.db.repositories.document_repo import DocumentRepository
from app.schemas.document import (
    DocumentListResponse,
    DocumentOut,
    IngestResponse,
    PresignedUrlResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["documents"])


def _public_document(record: dict) -> DocumentOut:
    return DocumentOut.model_validate({key: value for key, value in record.items() if key != "storage_key"})


def _safe_filename(filename: str | None) -> str:
    value = PurePath(filename or "document.pdf").name
    value = re.sub(r"[^\w. ()-]", "_", value, flags=re.UNICODE).strip(" .")
    return (value or "document.pdf")[:180]


async def _process_document(
    *,
    request: Request,
    owner_id: UUID,
    document_id: UUID,
    content: bytes,
    doc_type: str,
) -> None:
    pool = request.app.state.pool
    document_repo = DocumentRepository(pool)
    chunk_repo = ChunkRepository(pool)
    parser = request.app.state.pdf_parser
    chunker = request.app.state.chunker
    embedding = request.app.state.embedding
    try:
        parsed = parser.parse(content)
        if parsed.requires_ocr:
            await document_repo.update_status(
                owner_id,
                document_id,
                status="ocr_required",
                page_count=parsed.page_count,
                error_message="PDF không có lớp text; cần OCR trước khi lập chỉ mục.",
            )
            return

        chunks = chunker.build(document_id, parsed.pages, doc_type=doc_type)
        if not chunks:
            raise ValueError("Không trích xuất được nội dung có thể lập chỉ mục")
        vectors = await embedding.encode([chunk.content for chunk in chunks])
        if len(vectors) != len(chunks):
            raise RuntimeError("Embedding service trả về số vector không khớp số chunk")
        await chunk_repo.replace_for_document(
            owner_id,
            document_id,
            [
                {"id": chunk.id, "content": chunk.content, "metadata": chunk.metadata, "embedding": vector}
                for chunk, vector in zip(chunks, vectors, strict=True)
            ],
        )
        await document_repo.update_status(
            owner_id,
            document_id,
            status="ready",
            page_count=parsed.page_count,
            chunk_count=len(chunks),
            error_message=None,
        )
    except Exception as exc:
        logger.exception("Document processing failed", extra={"document_id": str(document_id)})
        await document_repo.update_status(
            owner_id,
            document_id,
            status="failed",
            error_message=str(exc)[:1000],
        )


@router.post("/ingest", response_model=IngestResponse, status_code=status.HTTP_202_ACCEPTED)
async def ingest_document(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    pool: PoolDep,
    settings: SettingsDep,
    file: Annotated[UploadFile, File(description="PDF tài liệu cần lập chỉ mục")],
    subject: Annotated[Literal["Toán", "Lý", "Hóa", "Chung"], Form()] = "Chung",
    doc_type: Annotated[Literal["exam", "textbook"], Form()] = "exam",
) -> IngestResponse:
    if file.content_type not in (None, "application/pdf", "application/octet-stream"):
        raise AppError(415, "Chỉ chấp nhận file PDF", code="unsupported_media_type")
    content = await file.read(settings.max_upload_size_bytes + 1)
    if len(content) > settings.max_upload_size_bytes:
        raise AppError(413, "File vượt quá giới hạn 50 MB", code="file_too_large")
    if not content.startswith(b"%PDF-"):
        raise AppError(415, "File không có định dạng PDF hợp lệ", code="invalid_pdf")

    filename = _safe_filename(file.filename)
    file_hash = hashlib.sha256(content).hexdigest()
    document_repo = DocumentRepository(pool)
    duplicate = await document_repo.find_by_hash(current_user.id, file_hash)
    if duplicate:
        raise AppError(409, "Tài liệu này đã tồn tại trong thư viện", code="duplicate_document")

    document_id = uuid4()
    storage_key = f"users/{current_user.id}/documents/{document_id}/{filename}"
    try:
        await request.app.state.storage.upload_pdf(storage_key, content)
        record = await document_repo.create(
            current_user.id,
            storage_key=storage_key,
            title=PurePath(filename).stem[:180],
            filename=filename,
            file_hash=file_hash,
            file_size_bytes=len(content),
            subject=subject,
            doc_type=doc_type,
        )
    except Exception:
        await request.app.state.storage.delete(storage_key)
        raise

    background_tasks.add_task(
        _process_document,
        request=request,
        owner_id=current_user.id,
        document_id=document_id,
        content=content,
        doc_type=doc_type,
    )
    return IngestResponse(document=_public_document(record))


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    current_user: CurrentUser,
    pool: PoolDep,
    subject: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> DocumentListResponse:
    if subject and subject not in {"Toán", "Lý", "Hóa", "Chung"}:
        raise AppError(422, "Môn học không hợp lệ", code="invalid_subject")
    if status_filter and status_filter not in {"processing", "ready", "failed", "ocr_required"}:
        raise AppError(422, "Trạng thái không hợp lệ", code="invalid_status")
    records, total = await DocumentRepository(pool).list(
        current_user.id,
        subject=subject,
        status=status_filter,
        search=search,
        limit=limit,
        offset=offset,
    )
    return DocumentListResponse(items=[_public_document(record) for record in records], total=total)


@router.get("/stats")
async def document_stats(current_user: CurrentUser, pool: PoolDep) -> dict[str, int]:
    return await DocumentRepository(pool).stats(current_user.id)


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(document_id: UUID, current_user: CurrentUser, pool: PoolDep) -> DocumentOut:
    record = await DocumentRepository(pool).get(current_user.id, document_id)
    if not record:
        raise HTTPException(status_code=404, detail="Document not found")
    return _public_document(record)


@router.get("/{document_id}/url", response_model=PresignedUrlResponse)
async def get_document_url(document_id: UUID, current_user: CurrentUser, pool: PoolDep, request: Request) -> PresignedUrlResponse:
    record = await DocumentRepository(pool).get(current_user.id, document_id)
    if not record:
        raise HTTPException(status_code=404, detail="Document not found")
    expires_in = 900
    url = await request.app.state.storage.presigned_url(record["storage_key"], expires_in=expires_in)
    return PresignedUrlResponse(url=url, expires_in=expires_in)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: UUID, current_user: CurrentUser, pool: PoolDep, request: Request) -> Response:
    repository = DocumentRepository(pool)
    record = await repository.get(current_user.id, document_id)
    if not record:
        raise HTTPException(status_code=404, detail="Document not found")
    storage_key = await repository.delete(current_user.id, document_id)
    if storage_key:
        try:
            await request.app.state.storage.delete(storage_key)
        except Exception:
            logger.exception("Failed to delete S3 object", extra={"document_id": str(document_id)})
    return Response(status_code=status.HTTP_204_NO_CONTENT)
