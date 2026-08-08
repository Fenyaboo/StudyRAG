import time
from uuid import uuid4

import jwt

from app.core.auth import _decode_token
from app.core.config import Settings


def test_legacy_jwt_decode():
    secret = "test-secret"
    user_id = str(uuid4())
    settings = Settings(
        SUPABASE_JWT_SECRET=secret,
        SUPABASE_JWT_ISSUER="https://example.supabase.co/auth/v1",
    )
    token = jwt.encode(
        {"sub": user_id, "aud": "authenticated", "iss": settings.supabase_jwt_issuer, "exp": int(time.time()) + 60},
        secret,
        algorithm="HS256",
    )
    claims = _decode_token(token, settings)
    assert claims["sub"] == user_id
