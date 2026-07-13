import pytest
import io
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.api.routes import ingest as ingest_route
from app.core.config import settings
from app.db.supabase import StorageRepository
from app.services.pdf_parser import parse_pdf_bytes, OCRRequiredException, PDFParseException
from app.services.chunker import chunk_exam_document, chunk_textbook_document


@pytest.fixture
def repository(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path / "raw"))
    monkeypatch.setattr(settings, "PROCESSED_DIR", str(tmp_path / "processed"))
    monkeypatch.setattr(settings, "DATABASE_URL", "sqlite:///ingest-test.db")
    monkeypatch.setattr(settings, "VECTOR_STORE_TYPE", "sqlite_chroma")
    return StorageRepository()


@pytest.fixture
def ready_document():
    return {
        "title": "Đề Toán",
        "filename": "math.pdf",
        "file_hash": "shared-hash",
        "file_size_bytes": 1,
        "subject": "Toán",
        "doc_type": "exam",
        "status": "ready",
        "page_count": 1,
        "chunk_count": 0,
        "error_message": None,
    }

def test_pdf_parser_empty_or_invalid():
    with pytest.raises(PDFParseException):
        parse_pdf_bytes(b"invalid bytes not a pdf", filename="bad.pdf")

def test_chunk_exam_document_regex():
    # Giả lập 2 trang PDF chứa đề thi
    pages = [
        {
            "page_number": 1,
            "content": "SỞ GIÁO DỤC VÀ ĐÀO TẠO\nĐỀ THI THỬ THPT QUỐC GIA\n\nCâu 1: Hàm số nào sau đây đồng biến trên R?\nA. y = x^3 + x\nB. y = x^2\nC. y = 1/x\nD. y = x^4\n\nCâu 2: Đạo hàm của hàm số y = sin(x) là:\nA. cos(x)\nB. -cos(x)\nC. tan(x)\nD. -sin(x)"
        },
        {
            "page_number": 2,
            "content": "Câu 3: Tính tích phân từ 0 đến 1 của x dx.\nA. 1/2\nB. 1\nC. 2\nD. 0"
        }
    ]
    
    chunks = chunk_exam_document(pages, document_id="test_doc_123")
    assert len(chunks) >= 3
    # Kiểm tra metadata từng câu hỏi
    q1_chunk = next(c for c in chunks if c["metadata"]["question_number"] == "1")
    assert "Hàm số nào sau đây đồng biến" in q1_chunk["content"]
    assert q1_chunk["metadata"]["is_exam_question"] is True
    assert q1_chunk["metadata"]["page_number"] == 1

@pytest.mark.asyncio
async def test_ingest_endpoint_invalid_file_type(auth_override, user_a_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/ingest",
            files={"file": ("test.txt", b"Hello world", "text/plain")},
            headers=user_a_headers,
        )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_FILE_TYPE"

@pytest.mark.asyncio
async def test_get_documents_endpoint(auth_override, user_a_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/documents", headers=user_a_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_user_cannot_delete_another_users_document(
    repository, ready_document, auth_override, user_a_headers, monkeypatch
):
    repository.save_document_metadata({
        **ready_document,
        "id": "user-b-document",
        "owner_id": "user-b",
        "storage_path": "user-b/user-b-document/math.pdf",
    })
    monkeypatch.setattr(ingest_route, "storage_repo", repository)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.delete("/api/v1/documents/user-b-document", headers=user_a_headers)

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_restores_private_pdf_when_metadata_deletion_fails(
    repository, ready_document, auth_override, user_a_headers, monkeypatch
):
    document = {
        **ready_document,
        "id": "restore-on-metadata-failure",
        "owner_id": "user-a",
        "storage_path": "user-a/restore-on-metadata-failure/math.pdf",
    }
    repository.save_document_metadata(document)
    monkeypatch.setattr(ingest_route, "storage_repo", repository)
    monkeypatch.setattr(repository, "delete_document", lambda *_: False)

    events: list[tuple[str, object]] = []

    class StorageWithRestore:
        def download_pdf(self, storage_path: str) -> bytes:
            events.append(("download", storage_path))
            return b"original-pdf"

        def delete_pdf(self, storage_path: str) -> None:
            events.append(("delete", storage_path))

        def restore_pdf(self, storage_path: str, content: bytes) -> None:
            events.append(("restore", (storage_path, content)))

    monkeypatch.setattr(ingest_route, "private_storage", StorageWithRestore())

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.delete(
            "/api/v1/documents/restore-on-metadata-failure", headers=user_a_headers
        )

    assert response.status_code == 500
    assert events == [
        ("download", document["storage_path"]),
        ("delete", document["storage_path"]),
        ("restore", (document["storage_path"], b"original-pdf")),
    ]
    assert repository.list_documents("user-a")[0]["id"] == document["id"]


def test_list_documents_returns_only_the_current_owner(repository, ready_document):
    repository.save_document_metadata({
        **ready_document,
        "id": "a-doc",
        "owner_id": "user-a",
        "storage_path": "user-a/a-doc/math.pdf",
    })
    repository.save_document_metadata({
        **ready_document,
        "id": "b-doc",
        "owner_id": "user-b",
        "storage_path": "user-b/b-doc/math.pdf",
    })

    assert [item["id"] for item in repository.list_documents("user-a")] == ["a-doc"]


def test_postgres_persistence_failure_is_not_silently_written_to_local_storage(
    repository, ready_document, monkeypatch
):
    repository.is_postgres = True

    def unavailable_connection():
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(repository, "_get_pg_connection", unavailable_connection)
    document = {
        **ready_document,
        "id": "persistence-failure",
        "owner_id": "user-a",
        "storage_path": "user-a/persistence-failure/math.pdf",
    }

    with pytest.raises(RuntimeError, match="Lưu Supabase thất bại"):
        repository.save_document_metadata(document)

    with pytest.raises(RuntimeError, match="Lưu chunks Supabase thất bại"):
        repository.save_chunks("persistence-failure", [{
            "id": "persistence-failure-chunk",
            "document_id": "persistence-failure",
            "content": "Nội dung kiểm thử",
            "metadata": {"page_number": 1},
        }])
