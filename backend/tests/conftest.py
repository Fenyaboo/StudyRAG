import importlib.util
import os
from collections.abc import Iterator
from uuid import UUID

import pytest

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("EMBEDDING_MODEL", "test-model")
os.environ.setdefault("EMBEDDING_DIMENSION", "3")
# Phải đặt trước khi bất kỳ module nào import app.core.config, vì get_settings() có
# lru_cache nên giá trị cờ chỉ được phân giải một lần cho cả tiến trình pytest.
os.environ.setdefault("AI_FEATURES_ENABLED", "false")

# Các module ML thuộc tập dependency AI tùy chọn (backend/requirements-ai.txt).
AI_MODULES = ("sentence_transformers", "torch", "transformers", "numpy")

TEST_OWNER_ID = UUID("11111111-1111-1111-1111-111111111111")
OTHER_OWNER_ID = UUID("22222222-2222-2222-2222-222222222222")


def missing_ai_dependencies() -> list[str]:
    """Tên các module ML chưa được cài trong môi trường hiện tại."""
    return [name for name in AI_MODULES if importlib.util.find_spec(name) is None]


requires_ai_dependencies = pytest.mark.skipif(
    bool(missing_ai_dependencies()),
    reason=(
        "Bỏ qua test phụ thuộc AI: AI_FEATURES_ENABLED=false và thiếu dependency AI "
        "tùy chọn trong backend/requirements-ai.txt"
    ),
)


@pytest.fixture
def fake_pages():
    from app.services.pdf_parser import PageText

    return [
        PageText(page_number=1, text="Định luật bảo toàn cơ năng.\n\nCơ năng được bảo toàn khi chỉ có lực thế."),
        PageText(page_number=2, text="Bài tập: Một vật chuyển động trong trọng trường."),
    ]


@pytest.fixture
def fake_pool():
    from tests.fakes import FakePool

    return FakePool()


@pytest.fixture
def api_client(monkeypatch, fake_pool) -> Iterator["object"]:
    """TestClient với app.state được nạp bằng fake, KHÔNG chạy lifespan.

    Dùng `TestClient(app)` ngoài context manager để lifespan thật (tạo asyncpg pool,
    quét fail_stale_processing) không chạy. Hành vi của lifespan được kiểm chứng riêng
    trong `test_lifespan.py`.

    `monkeypatch.setattr` trên `app.state` tự hoàn nguyên sau mỗi test; `app` là object
    ở module scope dùng chung nên gán trực tiếp sẽ làm rò trạng thái giữa các test.
    """
    from fastapi.testclient import TestClient

    from app.api.deps import get_pool
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.main import app
    from app.services.rate_limit import InMemoryRateLimiter
    from tests.fakes import FakeStorage

    state = {
        "ai_enabled": False,
        "pool": fake_pool,
        "storage": FakeStorage(),
        "dify": None,
        "embedding": None,
        "chunker": None,
        "retriever": None,
        "rate_limiter": InMemoryRateLimiter(30),
    }
    for name, value in state.items():
        monkeypatch.setattr(app.state, name, value, raising=False)

    app.dependency_overrides[get_pool] = lambda: fake_pool
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=TEST_OWNER_ID, email="hocsinh@example.vn"
    )
    # `require_ai_features` cố tình KHÔNG được override: nó là đối tượng đang kiểm chứng.
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
