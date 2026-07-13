import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_query_validation_error():
    """Kiểm tra lỗi khi gửi câu hỏi rỗng"""
    res = client.post("/api/v1/query", json={"query": ""})
    assert res.status_code == 400
    assert "không được để trống" in res.json()["detail"]

def test_query_mock_rag():
    """Kiểm tra endpoint /query trả về đúng cấu trúc QueryResponse"""
    res = client.post("/api/v1/query", json={"query": "Kiểm tra hệ thống RAG"})
    assert res.status_code == 200
    data = res.json()
    assert "answer" in data
    assert "citations" in data
    assert "provider" in data
    assert "latency_ms" in data
