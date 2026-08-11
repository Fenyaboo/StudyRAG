from app.main import app


def test_api_routes_are_mounted():
    paths = {route.path for route in app.routes if getattr(route, "path", None)}
    assert "/api/v1/health" in paths
    assert "/api/v1/documents/ingest" in paths
    assert "/api/v1/conversations/{conversation_id}/messages" in paths
    assert "/api/v1/chat" in paths


def test_chat_route_still_exists_in_disabled_mode(api_client):
    """Task 6.4 — cổng trả 503, KHÔNG phải 404/405.

    Tắt AI không được làm biến mất route hay đổi phương thức HTTP (NFR 3): client cũ vẫn
    gọi đúng endpoint và nhận một lỗi có nghĩa thay vì "không tìm thấy".
    """
    paths = {route.path for route in app.routes if getattr(route, "path", None)}
    assert "/api/v1/chat" in paths

    response = api_client.post("/api/v1/chat", json={"query": "câu hỏi thử"})
    assert response.status_code == 503
    assert response.status_code not in (404, 405)
