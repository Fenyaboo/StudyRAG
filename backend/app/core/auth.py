from functools import lru_cache
from typing import Annotated, Any
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from pydantic import BaseModel, Field, ValidationError

from app.core.config import Settings, get_settings


class AuthenticatedUser(BaseModel):
    id: UUID
    email: str | None = None
    role: str = "authenticated"
    claims: dict[str, Any] = Field(default_factory=dict)


bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache(maxsize=4)
def _jwks_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)


def _decode_token(token: str, settings: Settings) -> dict[str, Any]:
    issuer = settings.supabase_jwt_issuer or None
    common_options = {"verify_aud": True, "verify_iss": issuer is not None}

    if settings.supabase_jwt_secret:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            issuer=issuer,
            options=common_options,
        )

    if not settings.supabase_url:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Auth is not configured")

    signing_key = _jwks_client(settings.jwks_url).get_signing_key_from_jwt(token)
    algorithm = signing_key.algorithm_name or "RS256"
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=[algorithm],
        audience="authenticated",
        issuer=issuer,
        options=common_options,
    )


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        claims = _decode_token(credentials.credentials, settings)
        user_id = UUID(str(claims["sub"]))
        return AuthenticatedUser(
            id=user_id,
            email=claims.get("email"),
            role=str(claims.get("role", "authenticated")),
            claims=claims,
        )
    except (jwt.PyJWTError, KeyError, ValueError, ValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
