import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.core.auth import (
    CurrentUser,
    _fetch_supabase_auth_user,
    _is_confirmed_supabase_user,
    decode_supabase_token,
    get_current_user,
)
from app.main import app


@pytest.mark.asyncio
async def test_documents_require_a_bearer_token():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/v1/documents")

    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required."


@pytest.mark.asyncio
async def test_malformed_authorization_header_is_rejected():
    with pytest.raises(HTTPException, match="Authentication required") as exc_info:
        await get_current_user("Token not-a-bearer-token")

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_valid_bearer_token_returns_a_stable_current_user(monkeypatch):
    monkeypatch.setattr(
        "app.core.auth._decode_with_jwks",
        lambda _token: {
            "sub": "user-123",
            "email": "student@example.com",
            "iss": "https://project.supabase.co/auth/v1",
            "aud": "authenticated",
        },
    )
    monkeypatch.setattr("app.core.auth.settings.SUPABASE_JWT_ISSUER", "https://project.supabase.co/auth/v1")
    monkeypatch.setattr("app.core.auth.settings.SUPABASE_JWT_AUDIENCE", "authenticated")
    lookup_tokens: list[str] = []

    async def confirmed_supabase_user(token: str):
        lookup_tokens.append(token)
        return {
            "id": "user-123",
            "email": "student@example.com",
            "email_confirmed_at": "2026-07-13T00:00:00Z",
        }

    monkeypatch.setattr(
        "app.core.auth._fetch_supabase_auth_user",
        confirmed_supabase_user,
        raising=False,
    )

    current_user = await get_current_user("Bearer valid-token")

    assert current_user == CurrentUser(id="user-123", email="student@example.com")
    assert lookup_tokens == ["valid-token"]


@pytest.mark.asyncio
async def test_unconfirmed_email_identity_is_rejected_by_supabase_user_lookup(monkeypatch):
    monkeypatch.setattr(
        "app.core.auth._decode_with_jwks",
        lambda _token: {
            "sub": "u1",
            "iss": "https://project.supabase.co/auth/v1",
            "aud": "authenticated",
        },
    )
    monkeypatch.setattr("app.core.auth.settings.SUPABASE_JWT_ISSUER", "https://project.supabase.co/auth/v1")
    monkeypatch.setattr("app.core.auth.settings.SUPABASE_JWT_AUDIENCE", "authenticated")
    lookup_tokens: list[str] = []

    async def unconfirmed_supabase_user(token: str):
        lookup_tokens.append(token)
        return {
            "id": "u1",
            "email": "unconfirmed@example.com",
            "email_confirmed_at": None,
        }

    monkeypatch.setattr(
        "app.core.auth._fetch_supabase_auth_user",
        unconfirmed_supabase_user,
        raising=False,
    )

    with pytest.raises(HTTPException, match="Invalid authentication token") as exc_info:
        await get_current_user("Bearer unconfirmed-email")

    assert exc_info.value.status_code == 401
    assert lookup_tokens == ["unconfirmed-email"]


@pytest.mark.parametrize(
    "email_confirmed_at",
    [
        "",
        "not-a-timestamp",
        "2026-07-13",
        1,
        {"confirmed": True},
    ],
)
def test_supabase_user_lookup_rejects_non_timestamp_confirmation_values(email_confirmed_at):
    assert not _is_confirmed_supabase_user(
        {"id": "user-123", "email_confirmed_at": email_confirmed_at},
        "user-123",
    )


@pytest.mark.parametrize(
    "email_confirmed_at",
    ["2026-07-13T00:00:00Z", "2026-07-13T07:00:00+07:00"],
)
def test_supabase_user_lookup_accepts_iso_and_rfc3339_confirmation_timestamps(email_confirmed_at):
    assert _is_confirmed_supabase_user(
        {"id": "user-123", "email_confirmed_at": email_confirmed_at},
        "user-123",
    )


@pytest.mark.asyncio
async def test_google_identity_is_valid_when_supabase_user_is_confirmed(monkeypatch):
    monkeypatch.setattr(
        "app.core.auth._decode_with_jwks",
        lambda _token: {
            "sub": "google-user",
            "iss": "https://project.supabase.co/auth/v1",
            "aud": "authenticated",
            "app_metadata": {"provider": "google", "providers": ["google"]},
        },
    )
    monkeypatch.setattr("app.core.auth.settings.SUPABASE_JWT_ISSUER", "https://project.supabase.co/auth/v1")
    monkeypatch.setattr("app.core.auth.settings.SUPABASE_JWT_AUDIENCE", "authenticated")
    async def confirmed_google_user(token: str):
        assert token == "google-identity"
        return {
            "id": "google-user",
            "email": "student@gmail.com",
            "email_confirmed_at": "2026-07-13T00:00:00Z",
        }

    monkeypatch.setattr(
        "app.core.auth._fetch_supabase_auth_user",
        confirmed_google_user,
        raising=False,
    )

    current_user = await get_current_user("Bearer google-identity")

    assert current_user == CurrentUser(id="google-user", email="student@gmail.com")


@pytest.mark.asyncio
async def test_supabase_user_lookup_keeps_the_user_bearer_token_and_service_role_key_separate(monkeypatch):
    captured: dict[str, object] = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"id": "user-123", "email_confirmed_at": "2026-07-13T00:00:00Z"}

    class FakeAsyncClient:
        def __init__(self, *, timeout: float):
            captured["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return None

        async def get(self, url: str, *, headers: dict[str, str]):
            captured["url"] = url
            captured["headers"] = headers
            return FakeResponse()

    monkeypatch.setattr("app.core.auth.httpx.AsyncClient", FakeAsyncClient)
    monkeypatch.setattr("app.core.auth.settings.SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setattr("app.core.auth.settings.SUPABASE_SERVICE_ROLE_KEY", "server-only-key")

    user = await _fetch_supabase_auth_user("user-access-token")

    assert user["id"] == "user-123"
    assert captured == {
        "timeout": 10.0,
        "url": "https://project.supabase.co/auth/v1/user",
        "headers": {
            "Authorization": "Bearer user-access-token",
            "apikey": "server-only-key",
        },
    }


@pytest.mark.asyncio
async def test_supabase_user_lookup_must_match_the_verified_jwt_subject(monkeypatch):
    monkeypatch.setattr(
        "app.core.auth._decode_with_jwks",
        lambda _token: {
            "sub": "user-123",
            "iss": "https://project.supabase.co/auth/v1",
            "aud": "authenticated",
        },
    )
    monkeypatch.setattr("app.core.auth.settings.SUPABASE_JWT_ISSUER", "https://project.supabase.co/auth/v1")
    monkeypatch.setattr("app.core.auth.settings.SUPABASE_JWT_AUDIENCE", "authenticated")

    async def another_confirmed_user(_token: str):
        return {
            "id": "different-user",
            "email_confirmed_at": "2026-07-13T00:00:00Z",
        }

    monkeypatch.setattr("app.core.auth._fetch_supabase_auth_user", another_confirmed_user)

    with pytest.raises(HTTPException, match="Invalid authentication token") as exc_info:
        await get_current_user("Bearer valid-token")

    assert exc_info.value.status_code == 401


def test_wrong_issuer_is_rejected(monkeypatch):
    monkeypatch.setattr(
        "app.core.auth._decode_with_jwks",
        lambda _token: {"sub": "u1", "iss": "wrong", "aud": "authenticated"},
    )
    monkeypatch.setattr("app.core.auth.settings.SUPABASE_JWT_ISSUER", "https://project.supabase.co/auth/v1")

    with pytest.raises(HTTPException, match="Invalid authentication token") as exc_info:
        decode_supabase_token("bad-issuer")

    assert exc_info.value.status_code == 401


def test_missing_subject_is_rejected(monkeypatch):
    monkeypatch.setattr(
        "app.core.auth._decode_with_jwks",
        lambda _token: {
            "iss": "https://project.supabase.co/auth/v1",
            "aud": "authenticated",
        },
    )
    monkeypatch.setattr("app.core.auth.settings.SUPABASE_JWT_ISSUER", "https://project.supabase.co/auth/v1")
    monkeypatch.setattr("app.core.auth.settings.SUPABASE_JWT_AUDIENCE", "authenticated")

    with pytest.raises(HTTPException, match="Invalid authentication token") as exc_info:
        decode_supabase_token("missing-subject")

    assert exc_info.value.status_code == 401
