from app.main import app


def test_api_routes_are_mounted():
    paths = {route.path for route in app.routes if getattr(route, "path", None)}
    assert "/api/v1/health" in paths
    assert "/api/v1/documents/ingest" in paths
    assert "/api/v1/conversations/{conversation_id}/messages" in paths
    assert "/api/v1/chat" in paths
