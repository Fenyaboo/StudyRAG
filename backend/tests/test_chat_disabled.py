"""Task 6.3 — cổng ai_features_disabled. Gồm Property 7 (cổng là hàm hằng)."""

from hypothesis import HealthCheck, given, settings as hypothesis_settings, strategies as st

VALID_BODY = {"query": "Định luật bảo toàn cơ năng phát biểu thế nào?"}


def test_returns_503_with_vietnamese_message(api_client):
    response = api_client.post("/api/v1/chat", json=VALID_BODY)
    assert response.status_code == 503
    error = response.json()["error"]
    assert error["code"] == "ai_features_disabled"
    assert 20 <= len(error["message"]) <= 200
    assert "tạm ngưng" in error["message"]


def test_does_not_open_sse_channel(api_client):
    response = api_client.post("/api/v1/chat", json=VALID_BODY)
    assert "text/event-stream" not in response.headers.get("content-type", "")
    assert "X-Conversation-ID" not in response.headers
    assert "X-User-Message-ID" not in response.headers
    for event in ("event: token", "event: done", "event: error"):
        assert event not in response.text


def test_writes_nothing_and_calls_no_dify(api_client, fake_pool, monkeypatch):
    from app.main import app
    from tests.fakes import FakeDify

    dify = FakeDify()
    monkeypatch.setattr(app.state, "dify", dify, raising=False)

    api_client.post("/api/v1/chat", json=VALID_BODY)

    assert dify.call_count == 0
    assert fake_pool.executed_statements == []
    assert fake_pool.status_updates == []


def test_schema_invalid_body_still_returns_503(api_client):
    """Cổng chạy trước khi FastAPI validate body, nên không phải 422."""
    for body in ({}, {"query": ""}, {"query": "hi", "document_id": "khong-phai-uuid"}):
        response = api_client.post("/api/v1/chat", json=body)
        assert response.status_code == 503, body
        assert response.json()["error"]["code"] == "ai_features_disabled"


def test_unparseable_json_body_returns_422(api_client):
    """Yêu cầu 2 tiêu chí 9: FastAPI decode body trước khi giải dependency.

    Đây là hành vi đã được đặc tả, không phải vi phạm cổng.
    """
    response = api_client.post(
        "/api/v1/chat",
        content=b'{"query":',
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_missing_token_returns_401_not_503(api_client):
    """401 phải thắng 503: cổng phụ thuộc CurrentUser nên xác thực chạy trước."""
    from app.core.auth import get_current_user
    from app.main import app

    app.dependency_overrides.pop(get_current_user, None)
    response = api_client.post("/api/v1/chat", json=VALID_BODY)
    assert response.status_code == 401
    assert response.json()["error"]["code"] != "ai_features_disabled"


def test_conversation_endpoints_are_not_gated(api_client):
    """Quyết định thiết kế: người dùng vẫn đọc được hội thoại của chính mình."""
    response = api_client.get("/api/v1/conversations")
    assert response.status_code != 503


# --- Property 7 -------------------------------------------------------------
# Với mọi body hợp lệ về cú pháp JSON (kể cả sai schema), response ở chế độ tắt là
# hằng 503 với đúng shape lỗi, không mở SSE và không sinh câu SQL nào.


def _schema_invalid_bodies():
    return st.one_of(
        st.just({}),
        st.fixed_dictionaries({"query": st.text(max_size=20)}),
        st.fixed_dictionaries({"query": st.just("hi"), "document_id": st.text(max_size=12)}),
        st.fixed_dictionaries({"query": st.just("hi"), "conversation_id": st.text(max_size=12)}),
        st.dictionaries(st.text(min_size=1, max_size=8), st.text(max_size=8), max_size=3),
    )


@hypothesis_settings(
    max_examples=60,
    deadline=None,
    # api_client/fake_pool là fixture function-scoped, tái dùng có chủ đích trong một
    # property test: mỗi ví dụ chỉ đọc, và assertion về SQL kiểm trên tập tích lũy.
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
@given(body=st.one_of(st.just(VALID_BODY), _schema_invalid_bodies()))
def test_property_gate_is_constant_over_request_content(api_client, fake_pool, body):
    response = api_client.post("/api/v1/chat", json=body)

    assert response.status_code == 503
    error = response.json()["error"]
    assert error["code"] == "ai_features_disabled"
    assert 20 <= len(error["message"]) <= 200
    assert "text/event-stream" not in response.headers.get("content-type", "")
    assert "X-Conversation-ID" not in response.headers
    assert "X-User-Message-ID" not in response.headers
    assert fake_pool.executed_statements == []
