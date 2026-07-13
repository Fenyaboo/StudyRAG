import hashlib
import logging
import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from fastapi.responses import JSONResponse

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.schemas.document import DocumentResponse, IngestStatusResponse
from app.services.pdf_parser import parse_pdf_bytes, OCRRequiredException, PDFParseException
from app.services.chunker import process_document_chunks
from app.services.private_storage import PrivateStorage
from app.db.supabase import storage_repo

router = APIRouter()
logger = logging.getLogger(__name__)
private_storage = PrivateStorage()


def _delete_uploaded_object(storage_path: str) -> None:
    try:
        private_storage.delete_pdf(storage_path)
    except Exception:
        logger.exception("Không thể dọn object Storage sau khi ghi tài liệu thất bại.")

@router.post("/ingest", response_model=IngestStatusResponse, status_code=status.HTTP_201_CREATED)
async def ingest_document(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    subject: Optional[str] = Form("Chung"),
    doc_type: Optional[str] = Form("exam"),
):
    """
    Endpoint nạp tài liệu PDF đề thi / sách giáo khoa (Milestone 1):
    - Kiểm tra định dạng (.pdf) và dung lượng (< 25MB)
    - Tính SHA-256 chống trùng
    - Trích xuất văn bản trang bằng trang với PyMuPDF
    - Cắt đoạn thông minh (exam question chunking hoặc textbook heading chunking)
    - Lưu vào Supabase pgvector hoặc SQLite/JSONL
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": {"code": "INVALID_FILE_TYPE", "message": "Chỉ chấp nhận định dạng tài liệu PDF."}}
        )

    pdf_bytes = await file.read()
    file_size = len(pdf_bytes)

    if file_size > settings.MAX_UPLOAD_MB * 1024 * 1024:
        return JSONResponse(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            content={"error": {"code": "FILE_TOO_LARGE", "message": f"Dung lượng file vượt quá mức tối đa {settings.MAX_UPLOAD_MB}MB."}}
        )

    # SHA-256 deduplication
    file_hash = hashlib.sha256(pdf_bytes).hexdigest()
    existing_doc = storage_repo.get_document_by_hash(current_user.id, file_hash)
    if existing_doc and existing_doc.get("status") == "ready":
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "error": {
                    "code": "DUPLICATE_DOCUMENT",
                    "message": f"Tài liệu '{existing_doc.get('filename')}' đã tồn tại trong hệ thống với chữ ký SHA-256 trùng khớp.",
                    "details": {"existing_id": existing_doc.get("id")}
                }
            }
        )

    document_id = str(uuid.uuid4())
    doc_title = title or file.filename

    try:
        parsed = parse_pdf_bytes(pdf_bytes, filename=file.filename)
    except OCRRequiredException as ocr_err:
        try:
            storage_path = private_storage.put_pdf(
                current_user.id, document_id, file.filename, pdf_bytes
            )
            storage_repo.save_document_metadata({
                "id": document_id,
                "owner_id": current_user.id,
                "storage_path": storage_path,
                "title": doc_title,
                "filename": file.filename,
                "file_hash": file_hash,
                "file_size_bytes": file_size,
                "subject": subject,
                "doc_type": doc_type,
                "status": "ocr_required",
                "page_count": ocr_err.details.get("page_count", 0),
                "chunk_count": 0,
                "error_message": ocr_err.message,
            })
        except Exception:
            if "storage_path" in locals():
                _delete_uploaded_object(storage_path)
            raise
        # Ghi nhận trạng thái OCR_REQUIRED
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"error": {"code": "OCR_REQUIRED", "message": ocr_err.message, "details": ocr_err.details}}
        )
    except PDFParseException as parse_err:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": {"code": "PDF_PARSE_FAILED", "message": parse_err.message}}
        )

    # Cắt đoạn thông minh
    chunks = process_document_chunks(parsed["pages"], document_id, doc_type=doc_type)

    # Lưu dữ liệu vào storage
    doc_meta = {
        "id": document_id,
        "owner_id": current_user.id,
        "title": doc_title,
        "filename": file.filename,
        "file_hash": file_hash,
        "file_size_bytes": file_size,
        "subject": subject,
        "doc_type": doc_type,
        "status": "ready",
        "page_count": parsed["page_count"],
        "chunk_count": len(chunks),
        "error_message": None
    }

    storage_path = private_storage.put_pdf(current_user.id, document_id, file.filename, pdf_bytes)
    doc_meta["storage_path"] = storage_path
    metadata_saved = False
    try:
        storage_repo.save_document_metadata(doc_meta)
        metadata_saved = True
        storage_repo.save_chunks(document_id, chunks)
    except Exception:
        if metadata_saved:
            storage_repo.delete_document(current_user.id, document_id)
        _delete_uploaded_object(storage_path)
        raise

    return IngestStatusResponse(
        document_id=document_id,
        filename=file.filename,
        status="ready",
        page_count=parsed["page_count"],
        chunk_count=len(chunks),
        storage_engine="Supabase pgvector" if storage_repo.is_postgres else "SQLite + ChromaDB (Local)",
        message=f"Đã bóc tách thành công {parsed['page_count']} trang và lập chỉ mục {len(chunks)} đoạn tài liệu."
    )

@router.get("/documents", response_model=List[DocumentResponse])
async def get_documents(current_user: Annotated[CurrentUser, Depends(get_current_user)]):
    """Lấy danh sách toàn bộ tài liệu đã nạp trong thư viện."""
    return storage_repo.list_documents(current_user.id)

@router.delete("/documents/{document_id}", status_code=status.HTTP_200_OK)
async def delete_document(
    document_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Xóa tài liệu và toàn bộ đoạn văn bản (chunks) khỏi database."""
    document = next(
        (document for document in storage_repo.list_documents(current_user.id) if document.get("id") == document_id),
        None,
    )
    if not document:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu.")

    try:
        # Keep a server-side copy so a metadata failure cannot leave a visible
        # document record pointing to an irreversibly deleted private object.
        original_pdf = private_storage.download_pdf(document["storage_path"])
        private_storage.delete_pdf(document["storage_path"])
    except Exception as error:
        logger.error("Không thể đọc/xóa object Storage cho tài liệu %s: %s", document_id, error)
        raise HTTPException(status_code=500, detail="Không thể xóa tài liệu.") from error

    try:
        success = storage_repo.delete_document(current_user.id, document_id)
        if not success:
            raise RuntimeError("Document metadata was not deleted.")
    except Exception as error:
        try:
            private_storage.restore_pdf(document["storage_path"], original_pdf)
        except Exception:
            logger.exception("Không thể khôi phục object Storage sau khi xóa metadata thất bại: %s", document_id)
        logger.error("Không thể xóa metadata cho tài liệu %s: %s", document_id, error)
        raise HTTPException(status_code=500, detail="Không thể xóa tài liệu.") from error

    return {"message": "Đã xóa tài liệu và toàn bộ vector/chunks liên quan thành công."}
