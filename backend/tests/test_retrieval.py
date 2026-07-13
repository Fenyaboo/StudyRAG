from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.routes import query as query_route
from app.core.config import settings
from app.db.supabase import StorageRepository
from app.main import app



class EmptyStorage:
    def has_ready_documents(self, owner_id: str, document_id: str | None = None) -> bool:
        return False

    def search(self, **_: Any) -> list[dict[str, Any]]:
        raise AssertionError("LLM retrieval must not run when the library is empty")


class ContextlessStorage:
    def has_ready_documents(self, owner_id: str, document_id: str | None = None) -> bool:
        return True

    def search(self, **_: Any) -> list[dict[str, Any]]:
        return []


@pytest.mark.asyncio
async def test_query_returns_actionable_empty_library_guard(monkeypatch, auth_override, user_a_headers):
    monkeypatch.setattr(query_route, "storage_repo", EmptyStorage())

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/query",
            json={"query": "Tính khoảng cách từ A đến (SBC)"},
            headers=user_a_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["error"] == "NO_DOCUMENTS"
    assert data["provider"] == "retrieval-guard"
    assert data["citations"] == []
    assert "tải" in data["answer"].lower()


@pytest.mark.asyncio
async def test_query_skips_llm_when_no_relevant_context(monkeypatch, auth_override, user_a_headers):
    async def unexpected_llm_call(**_: Any) -> dict[str, Any]:
        raise AssertionError("LLM must not be called without retrieved context")

    monkeypatch.setattr(query_route, "storage_repo", ContextlessStorage())
    monkeypatch.setattr(query_route.LLMService, "generate_grounded_answer", unexpected_llm_call)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/query",
            json={"query": "Nội dung không có trong tài liệu"},
            headers=user_a_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["error"] == "NO_RELEVANT_CONTEXT"
    assert data["provider"] == "retrieval-guard"


def test_local_retrieval_normalizes_query_and_prioritizes_requested_page(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path / "raw"))
    monkeypatch.setattr(settings, "PROCESSED_DIR", str(tmp_path / "processed"))
    monkeypatch.setattr(settings, "DATABASE_URL", "sqlite:///retrieval-test.db")
    monkeypatch.setattr(settings, "VECTOR_STORE_TYPE", "sqlite_chroma")
    repository = StorageRepository()
    document_id = "geometry-document"

    repository.save_document_metadata({
        "id": document_id,
        "owner_id": "user-a",
        "storage_path": "user-a/geometry-document/e1b1.pdf",
        "title": "Kĩ năng tìm khoảng cách",
        "filename": "e1b1.pdf",
        "file_hash": "geometry-fixture",
        "file_size_bytes": 1,
        "subject": "Toán",
        "doc_type": "textbook",
        "status": "ready",
        "page_count": 2,
        "chunk_count": 2,
        "error_message": None,
    })
    repository.save_chunks(document_id, [
        {
            "id": "geometry-page-1",
            "document_id": document_id,
            "content": "Ví dụ 1. Tính khoảng cách từ điểm A đến mặt phẳng (SBC).",
            "metadata": {
                "page_number": 1,
                "section_title": "Ví dụ 1: Khoảng cách đến (SBC)",
                "question_number": None,
            },
        },
        {
            "id": "geometry-page-2",
            "document_id": document_id,
            "content": "Trang này trình bày một bài toán thể tích khối chóp khác.",
            "metadata": {
                "page_number": 2,
                "section_title": "Bài toán thể tích",
                "question_number": None,
            },
        },
    ])

    results = repository.search(
        "Tính khoảng cách từ A đến (SBC) trong Ví dụ 1 trang 1",
        owner_id="user-a",
        document_id=document_id,
    )

    assert results
    assert results[0]["id"] == "geometry-page-1"
    assert results[0]["page"] == 1
    assert repository.search("nội dung hoàn toàn không tồn tại", owner_id="user-a", document_id=document_id) == []


def test_local_retrieval_does_not_return_another_owners_chunks(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path / "raw"))
    monkeypatch.setattr(settings, "PROCESSED_DIR", str(tmp_path / "processed"))
    monkeypatch.setattr(settings, "DATABASE_URL", "sqlite:///retrieval-owner-test.db")
    monkeypatch.setattr(settings, "VECTOR_STORE_TYPE", "sqlite_chroma")
    repository = StorageRepository()

    for owner_id, document_id in (("user-a", "a-document"), ("user-b", "b-document")):
        repository.save_document_metadata({
            "id": document_id,
            "owner_id": owner_id,
            "storage_path": f"{owner_id}/{document_id}/shared.pdf",
            "title": f"Tài liệu {owner_id}",
            "filename": "shared.pdf",
            "file_hash": f"hash-{owner_id}",
            "file_size_bytes": 1,
            "subject": "Toán",
            "doc_type": "exam",
            "status": "ready",
            "page_count": 1,
            "chunk_count": 1,
            "error_message": None,
        })
        repository.save_chunks(document_id, [{
            "id": f"{document_id}-chunk",
            "document_id": document_id,
            "content": "Công thức khoảng cách trong không gian.",
            "metadata": {"page_number": 1, "section_title": "Khoảng cách"},
        }])

    results = repository.search("công thức khoảng cách", owner_id="user-a")

    assert [item["document_id"] for item in results] == ["a-document"]
