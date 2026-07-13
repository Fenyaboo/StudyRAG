import pytest
from httpx import AsyncClient, ASGITransport
from app.api.routes import query as query_route
from app.api.routes import system
from app.db.supabase import storage_repo
from app.main import app

@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "2.0.0"
    assert "timestamp" in data

@pytest.mark.asyncio
async def test_ready_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] in {"jsonl_ready", "postgres_ready"}
    assert data["vector_store"] == "lexical_retrieval_ready"
    assert data["details"].keys() == {
        "retrieval_top_k",
        "max_upload_mb",
        "retrieval_mode",
    }


def test_list_documents_requires_an_owner_id():
    with pytest.raises(TypeError):
        storage_repo.list_documents()


@pytest.mark.asyncio
async def test_ready_endpoint_does_not_list_private_documents(monkeypatch):
    def fail_if_listed(*args, **kwargs):
        raise AssertionError("Readiness must not list private documents.")

    monkeypatch.setattr(system.storage_repo, "list_documents", fail_if_listed)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/ready")

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_ready_endpoint_reports_unready_postgres_without_falling_back(monkeypatch):
    monkeypatch.setattr(system.storage_repo, "is_postgres", True)
    monkeypatch.setattr(system.storage_repo, "_postgres_ready", False)
    monkeypatch.setattr(
        system.storage_repo,
        "_postgres_error",
        "Supabase/PostgreSQL is not ready; apply the private-library migration.",
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/ready")

    assert response.status_code == 503
    assert response.json()["status"] == "not_ready"
    assert response.json()["database"] == "postgres_unready"
    assert "migration" in response.json()["details"]["database_error"]


@pytest.mark.asyncio
async def test_initialized_postgres_repository_is_shared_by_query_and_readiness(
    monkeypatch, auth_override, user_a_headers
):
    """Query must use the repository whose startup readiness was initialized."""
    class Cursor:
        def execute(self, _statement):
            pass

        def fetchone(self):
            return {
                "documents_table": True,
                "document_chunks_table": True,
                "owner_id_column": True,
                "storage_path_column": True,
                "documents_rls": True,
                "document_chunks_rls": True,
                "owner_documents_policy": True,
                "owner_document_chunks_policy": True,
                "owner_file_hash_index": True,
                "owner_created_at_index": True,
                "chunk_document_id_index": True,
                "private_bucket": True,
                "owner_study_documents_policy": True,
            }

        def close(self):
            pass

    class Connection:
        def cursor(self):
            return Cursor()

        def close(self):
            pass

    monkeypatch.setattr(storage_repo, "is_postgres", True)
    monkeypatch.setattr(storage_repo, "_postgres_ready", False)
    monkeypatch.setattr(storage_repo, "_postgres_error", "database not initialized")
    monkeypatch.setattr(storage_repo, "_get_pg_connection", lambda: Connection())
    storage_repo.init_db()
    monkeypatch.setattr(storage_repo, "has_ready_documents", lambda *_args, **_kwargs: False)

    assert query_route.storage_repo is storage_repo
    assert system.storage_repo is storage_repo

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        query_response = await client.post(
            "/api/v1/query",
            json={"query": "Tính khoảng cách từ A đến (SBC)"},
            headers=user_a_headers,
        )
        ready_response = await client.get("/api/v1/ready")

    assert query_response.status_code == 200
    assert query_response.json()["error"] == "NO_DOCUMENTS"
    assert ready_response.status_code == 200
    assert ready_response.json()["database"] == "postgres_ready"

@pytest.mark.asyncio
async def test_root_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
