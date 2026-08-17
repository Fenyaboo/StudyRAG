"""Task 5.6 — hợp đồng của hai probe /ready và tính bất biến của /health."""


def test_api_ready_is_ready_in_disabled_mode(api_client):
    """Dify/embedding chưa cấu hình nhưng database và storage OK -> vẫn ready."""
    response = api_client.get("/api/v1/ready")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["ai_enabled"] is False
    assert payload["checks"]["dify_configured"] is False
    assert payload["checks"]["embedding_configured"] is False
    assert payload["checks"]["database"] is True
    assert payload["message"] is None


def test_root_ready_agrees_with_api_ready(api_client):
    """Chốt hồi quy cho rủi ro R3: hai probe trùng lặp không được trôi lệch."""
    api = api_client.get("/api/v1/ready").json()
    root = api_client.get("/ready").json()
    assert root["status"] == api["status"]
    assert root["ai_enabled"] == api["ai_enabled"]


def test_health_has_no_ai_enabled_field(api_client):
    for path in ("/api/v1/health", "/health"):
        payload = api_client.get(path).json()
        assert payload == {"status": "ok", "service": "examoras-api", "version": "0.1.0"}
        assert "ai_enabled" not in payload


def test_ready_reports_not_ready_when_database_is_down(api_client, monkeypatch):
    from app.main import app

    monkeypatch.setattr(app.state, "pool", None, raising=False)
    payload = api_client.get("/api/v1/ready").json()
    assert payload["status"] == "not_ready"
    assert payload["checks"]["database"] is False
    assert payload["ai_enabled"] is False
    assert payload["message"]


def test_ready_becomes_strict_when_ai_enabled(api_client, monkeypatch):
    from app.main import app

    monkeypatch.setattr(app.state, "ai_enabled", True, raising=False)
    payload = api_client.get("/api/v1/ready").json()
    assert payload["ai_enabled"] is True
    # dify/embedding vẫn là None -> configured False -> not_ready ở chế độ bật.
    assert payload["status"] == "not_ready"
