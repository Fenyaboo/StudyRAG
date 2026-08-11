"""Task 8.6 / Property 2 — cách ly theo owner không phụ thuộc chế độ AI.

Tắt AI không được tạo ra đường dẫn nào bỏ qua điều kiện `owner_id`.
"""

from uuid import UUID, uuid4

import pytest

OWNER_SCOPED_TABLES = ("public.documents", "public.conversations", "public.messages")


def _owner_scoped_statements(pool):
    return [
        query
        for query in pool.executed_statements
        if any(table in query for table in OWNER_SCOPED_TABLES)
    ]


@pytest.mark.parametrize("ai_enabled", [False, True])
def test_cross_owner_document_returns_404_in_both_modes(api_client, fake_pool, monkeypatch, ai_enabled):
    from app.main import app

    monkeypatch.setattr(app.state, "ai_enabled", ai_enabled, raising=False)
    other_owner_document = uuid4()

    response = api_client.get(f"/api/v1/documents/{other_owner_document}")

    assert response.status_code == 404
    assert str(other_owner_document) not in response.text or response.json()["error"]["code"] == "not_found"


@pytest.mark.parametrize("ai_enabled", [False, True])
def test_cross_owner_conversation_returns_404_in_both_modes(api_client, monkeypatch, ai_enabled):
    from app.main import app

    monkeypatch.setattr(app.state, "ai_enabled", ai_enabled, raising=False)

    # Route thật là /{id}/messages; GET /{id} không tồn tại.
    response = api_client.get(f"/api/v1/conversations/{uuid4()}/messages")

    assert response.status_code == 404


@pytest.mark.parametrize("ai_enabled", [False, True])
def test_every_owner_scoped_query_carries_owner_predicate(api_client, fake_pool, monkeypatch, ai_enabled):
    """Mọi câu lệnh chạm bảng thuộc owner phải có điều kiện owner_id tường minh."""
    from app.main import app

    monkeypatch.setattr(app.state, "ai_enabled", ai_enabled, raising=False)

    api_client.get("/api/v1/documents")
    api_client.get("/api/v1/documents/stats")
    api_client.get(f"/api/v1/documents/{uuid4()}")
    api_client.get("/api/v1/conversations")

    statements = _owner_scoped_statements(fake_pool)
    assert statements, "Không có câu lệnh nào được ghi lại; test mất hiệu lực"
    for query in statements:
        assert "owner_id" in query, f"Câu lệnh thiếu điều kiện owner_id: {query}"


def test_unauthenticated_request_touches_no_data(api_client, fake_pool):
    from app.core.auth import get_current_user
    from app.main import app

    app.dependency_overrides.pop(get_current_user, None)

    for path in ("/api/v1/documents", "/api/v1/documents/stats", "/api/v1/conversations"):
        assert api_client.get(path).status_code == 401

    assert _owner_scoped_statements(fake_pool) == []


def test_authenticated_owner_id_is_the_one_used_in_queries(api_client, fake_pool):
    from tests.conftest import TEST_OWNER_ID

    api_client.get("/api/v1/documents")

    owner_args = [
        args[0]
        for query, args in fake_pool.connection.fetch_calls + fake_pool.connection.fetchval_calls
        if "public.documents" in query and args
    ]
    assert owner_args, "Không bắt được tham số owner_id nào"
    assert all(isinstance(value, UUID) and value == TEST_OWNER_ID for value in owner_args)
