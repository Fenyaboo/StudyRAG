from app.api.v1.chat import _sse


def test_sse_event_serializes_json():
    value = _sse("token", {"content": "Xin chào"})
    assert value.startswith("event: token\n")
    assert '"content": "Xin chào"' in value
    assert value.endswith("\n\n")
