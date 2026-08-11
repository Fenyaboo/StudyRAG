"""Task 2.3 — factory tầng AI báo lỗi rõ ràng khi thiếu dependency tùy chọn."""

import builtins

import pytest

from app.core.config import Settings
from app.services.ai_runtime import AI_EXTRA_HINT, AIDependencyError, build_ai_runtime, build_retriever


def _settings() -> Settings:
    return Settings(_env_file=None)


def _block_ml_imports(monkeypatch, blocked: str) -> None:
    real_import = builtins.__import__

    def guarded(name, globals=None, locals=None, fromlist=(), level=0):
        if name == blocked or name.startswith(f"{blocked}."):
            raise ImportError(f"No module named {blocked!r}", name=blocked)
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", guarded)
    # Các module AI có thể đã nằm trong sys.modules từ test khác; xóa để import chạy lại.
    for module in ("app.services.embedding", "app.services.retriever", "app.services.chunker"):
        monkeypatch.delitem(__import__("sys").modules, module, raising=False)


def test_build_ai_runtime_names_the_optional_dependency_set(monkeypatch):
    _block_ml_imports(monkeypatch, "numpy")

    with pytest.raises(AIDependencyError) as excinfo:
        build_ai_runtime(_settings())

    message = str(excinfo.value)
    assert AI_EXTRA_HINT in message
    assert "AI_FEATURES_ENABLED=true" in message


def test_build_retriever_names_the_optional_dependency_set(monkeypatch):
    _block_ml_imports(monkeypatch, "numpy")

    with pytest.raises(AIDependencyError) as excinfo:
        build_retriever(object(), object(), _settings())

    assert AI_EXTRA_HINT in str(excinfo.value)


def test_ai_dependency_error_is_a_runtime_error():
    """Lifespan không bắt lỗi này; nó phải lan lên và làm startup thất bại."""
    assert issubclass(AIDependencyError, RuntimeError)
