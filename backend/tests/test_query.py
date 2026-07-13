import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_query_validation_error(auth_override, user_a_headers):
    """Kiểm tra lỗi khi gửi câu hỏi rỗng"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/query", json={"query": ""}, headers=user_a_headers)
    assert res.status_code == 400
    assert "không được để trống" in res.json()["detail"]

@pytest.mark.asyncio
async def test_query_mock_rag(auth_override, user_a_headers):
    """Kiểm tra endpoint /query trả về đúng cấu trúc QueryResponse"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/query",
            json={"query": "Kiểm tra hệ thống RAG"},
            headers=user_a_headers,
        )
    assert res.status_code == 200
    data = res.json()
    assert "answer" in data
    assert "citations" in data
    assert "provider" in data
    assert "latency_ms" in data
