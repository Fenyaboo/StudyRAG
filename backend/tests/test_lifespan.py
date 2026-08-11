"""Task 3.3 — lifespan dựng tầng AI có điều kiện.

Cần test riêng vì fixture `api_client` cố tình không chạy lifespan.
"""

import logging
from types import SimpleNamespace

import pytest

import app.main as main_module
from app.services.ai_runtime import AIDependencyError
from tests.fakes import FakePool


def _settings(*, ai_enabled: bool) -> SimpleNamespace:
    return SimpleNamespace(
        ai_features_enabled=ai_enabled,
        chat_rate_limit_per_minute=30,
        ingest_timeout_seconds=900,
    )


@pytest.fixture
def app_stub():
    return SimpleNamespace(state=SimpleNamespace())


async def _run_lifespan(monkeypatch, app_stub, *, ai_enabled, build=None, pool=None):
    monkeypatch.setattr(main_module, "get_settings", lambda: _settings(ai_enabled=ai_enabled))
    monkeypatch.setattr(main_module, "StorageService", lambda settings: SimpleNamespace(configured=True))
    monkeypatch.setattr(main_module, "PDFParser", lambda: SimpleNamespace())
    monkeypatch.setattr(main_module, "InMemoryRateLimiter", lambda limit: SimpleNamespace(limit=limit))

    async def fake_create_pool(settings):
        if pool is None:
            raise RuntimeError("DATABASE_URL is not configured")
        return pool

    monkeypatch.setattr(main_module, "create_pool", fake_create_pool)
    monkeypatch.setattr(main_module, "close_pool", lambda pool: _noop())
    monkeypatch.setattr(
        main_module,
        "DocumentRepository",
        lambda pool: SimpleNamespace(fail_stale_processing=lambda **kwargs: _zero()),
    )
    if build is not None:
        monkeypatch.setattr(main_module, "build_ai_runtime", build)
    monkeypatch.setattr(main_module, "build_retriever", lambda pool, embedding, settings: "retriever")

    async with main_module.lifespan(app_stub):
        pass


async def _noop():
    return None


async def _zero():
    return 0


async def test_disabled_mode_leaves_ai_services_none(monkeypatch, app_stub):
    def must_not_be_called(settings):
        raise AssertionError("build_ai_runtime không được gọi ở AI_Disabled_Mode")

    await _run_lifespan(monkeypatch, app_stub, ai_enabled=False, build=must_not_be_called, pool=FakePool())

    state = app_stub.state
    assert state.ai_enabled is False
    assert state.dify is None
    assert state.embedding is None
    assert state.chunker is None
    assert state.retriever is None


async def test_enabled_mode_builds_ai_services(monkeypatch, app_stub):
    runtime = SimpleNamespace(dify="dify", embedding="embedding", chunker="chunker")
    await _run_lifespan(
        monkeypatch,
        app_stub,
        ai_enabled=True,
        build=lambda settings: runtime,
        pool=FakePool(),
    )

    state = app_stub.state
    assert state.ai_enabled is True
    assert (state.dify, state.embedding, state.chunker) == ("dify", "embedding", "chunker")
    assert state.retriever == "retriever"


async def test_missing_ai_dependency_fails_startup(monkeypatch, app_stub):
    """Không được tự động rơi về AI_Disabled_Mode."""

    def broken(settings):
        raise AIDependencyError("thiếu numpy")

    with pytest.raises(AIDependencyError):
        await _run_lifespan(monkeypatch, app_stub, ai_enabled=True, build=broken, pool=FakePool())


async def test_logs_flag_once(monkeypatch, app_stub, caplog):
    with caplog.at_level(logging.INFO, logger=main_module.__name__):
        await _run_lifespan(monkeypatch, app_stub, ai_enabled=False, pool=FakePool())

    entries = [record for record in caplog.records if "AI features enabled" in record.getMessage()]
    assert len(entries) == 1
    assert "False" in entries[0].getMessage()


async def test_database_failure_still_completes_startup(monkeypatch, app_stub):
    """Pool lỗi không được làm sập startup; readiness sẽ báo not_ready."""
    await _run_lifespan(monkeypatch, app_stub, ai_enabled=False, pool=None)

    assert app_stub.state.pool is None
    assert app_stub.state.retriever is None
