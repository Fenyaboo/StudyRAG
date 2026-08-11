from typing import Annotated

import asyncpg
from fastapi import Depends, HTTPException, Request, status

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.config import Settings, get_settings
from app.core.exceptions import AppError


SettingsDep = Annotated[Settings, Depends(get_settings)]
CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]

AI_DISABLED_MESSAGE = (
    "Tính năng hỏi đáp AI đang tạm ngưng để nâng cấp hệ thống. "
    "Bạn vẫn dùng được thư viện tài liệu và có thể thử lại sau."
)


def get_pool(request: Request) -> asyncpg.Pool:
    pool = getattr(request.app.state, "pool", None)
    if pool is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable")
    return pool


PoolDep = Annotated[asyncpg.Pool, Depends(get_pool)]


def require_ai_features(request: Request, current_user: CurrentUser) -> None:
    """Chặn request khi hệ thống ở AI_Disabled_Mode.

    Phụ thuộc `CurrentUser` để 401 luôn thắng 503: request thiếu token phải nhận 401
    theo hành vi xác thực hiện có. FastAPI cache dependency theo callable trong cùng một
    request nên `get_current_user` vẫn chỉ chạy một lần.

    Gắn ở mức router (không phải trong thân handler) vì FastAPI giải dependency trước khi
    validate các field của body, nên body sai schema vẫn nhận 503 thay vì 422.
    """
    if not bool(getattr(request.app.state, "ai_enabled", False)):
        raise AppError(503, AI_DISABLED_MESSAGE, code="ai_features_disabled")


AIFeaturesGate = Annotated[None, Depends(require_ai_features)]
