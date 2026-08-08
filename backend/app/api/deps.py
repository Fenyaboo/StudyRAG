from typing import Annotated

import asyncpg
from fastapi import Depends, HTTPException, Request, status

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.config import Settings, get_settings


SettingsDep = Annotated[Settings, Depends(get_settings)]
CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


def get_pool(request: Request) -> asyncpg.Pool:
    pool = getattr(request.app.state, "pool", None)
    if pool is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable")
    return pool


PoolDep = Annotated[asyncpg.Pool, Depends(get_pool)]
