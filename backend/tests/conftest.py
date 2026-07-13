import pytest
from fastapi import Header, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.main import app


@pytest.fixture
def user_a_headers() -> dict[str, str]:
    return {"Authorization": "Bearer user-a"}


@pytest.fixture
def auth_override():
    async def get_test_current_user(
        authorization: str | None = Header(default=None),
    ) -> CurrentUser:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
            )
        return CurrentUser(id=authorization.removeprefix("Bearer "), email=None)

    app.dependency_overrides[get_current_user] = get_test_current_user
    yield
    app.dependency_overrides.pop(get_current_user, None)
