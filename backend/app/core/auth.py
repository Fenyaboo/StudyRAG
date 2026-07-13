from datetime import datetime
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any

import httpx
import jwt
from fastapi import Header, HTTPException, status
from jwt import PyJWKClient

from app.core.config import settings


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None


def _invalid_token() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication token.",
    )


@lru_cache
def _jwks_client(issuer: str) -> PyJWKClient:
    return PyJWKClient(f"{issuer.rstrip('/')}/.well-known/jwks.json")


def _decode_with_jwks(token: str) -> dict[str, Any]:
    issuer = settings.SUPABASE_JWT_ISSUER
    if not issuer:
        raise ValueError("SUPABASE_JWT_ISSUER is not configured")

    signing_key = _jwks_client(issuer).get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=[signing_key.algorithm_name],
        options={"verify_aud": False, "verify_iss": False},
    )


def _has_expected_audience(audience: object, expected_audience: str) -> bool:
    if isinstance(audience, str):
        return audience == expected_audience
    if isinstance(audience, list):
        return expected_audience in audience
    return False


def decode_supabase_token(token: str) -> dict[str, Any]:
    try:
        claims = _decode_with_jwks(token)
    except Exception as error:
        raise _invalid_token() from error

    issuer = settings.SUPABASE_JWT_ISSUER
    audience = settings.SUPABASE_JWT_AUDIENCE
    subject = claims.get("sub")
    if (
        not issuer
        or claims.get("iss") != issuer
        or not _has_expected_audience(claims.get("aud"), audience)
        or not isinstance(subject, str)
        or not subject
    ):
        raise _invalid_token()

    return claims


async def _fetch_supabase_auth_user(token: str) -> dict[str, Any]:
    """Retrieve the current user from Supabase Auth using the presented JWT."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise _invalid_token()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                },
            )
            response.raise_for_status()
            user = response.json()
    except (httpx.HTTPError, TypeError, ValueError) as error:
        raise _invalid_token() from error

    if not isinstance(user, dict):
        raise _invalid_token()
    return user


def _is_valid_confirmation_timestamp(value: object) -> bool:
    if not isinstance(value, str) or "T" not in value:
        return False

    normalized_value = f"{value[:-1]}+00:00" if value.endswith("Z") else value
    try:
        datetime.fromisoformat(normalized_value)
    except ValueError:
        return False
    return True


def _is_confirmed_supabase_user(user: dict[str, Any], subject: str) -> bool:
    return (
        user.get("id") == subject
        and _is_valid_confirmation_timestamp(user.get("email_confirmed_at"))
    )


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    token = authorization.removeprefix("Bearer ")
    claims = decode_supabase_token(token)
    user = await _fetch_supabase_auth_user(token)
    if not _is_confirmed_supabase_user(user, claims["sub"]):
        raise _invalid_token()

    email = user.get("email")
    return CurrentUser(id=claims["sub"], email=email if isinstance(email, str) else None)
