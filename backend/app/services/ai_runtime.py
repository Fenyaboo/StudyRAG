"""Biên duy nhất nơi mã nguồn import tầng AI.

Tồn tại để `app/main.py` không cần import ML ở module scope, và để lỗi thiếu
dependency có thông điệp nêu rõ tên tập dependency tùy chọn cần cài.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from app.core.config import Settings

if TYPE_CHECKING:  # chỉ dùng cho type check, không import lúc runtime
    from app.services.chunker import SmartChunker
    from app.services.dify import DifyClient
    from app.services.embedding import EmbeddingService

AI_EXTRA_HINT = "pip install -r backend/requirements-ai.txt"


class AIDependencyError(RuntimeError):
    """Thiếu dependency AI tùy chọn trong khi AI_FEATURES_ENABLED=true."""


@dataclass(frozen=True, slots=True)
class AIRuntime:
    dify: DifyClient
    embedding: EmbeddingService
    chunker: SmartChunker


def build_ai_runtime(settings: Settings) -> AIRuntime:
    """Khởi tạo tầng AI.

    Raise `AIDependencyError` nếu `ML_Dependencies` chưa được cài. Lỗi này cố tình
    không được bắt trong lifespan: startup phải thất bại thay vì âm thầm rơi về
    `AI_Disabled_Mode`.
    """
    try:
        from app.services.chunker import SmartChunker
        from app.services.dify import DifyClient
        from app.services.embedding import EmbeddingService
    except ImportError as exc:
        raise AIDependencyError(
            f"AI_FEATURES_ENABLED=true nhưng thiếu dependency AI tùy chọn ({exc.name}). "
            f"Cài bằng: {AI_EXTRA_HINT}"
        ) from exc
    return AIRuntime(
        dify=DifyClient(settings),
        embedding=EmbeddingService(settings),
        chunker=SmartChunker(),
    )


def build_retriever(pool: Any, embedding: Any, settings: Settings) -> Any:
    """Dựng `HybridRetriever`.

    Tách khỏi `build_ai_runtime` vì retriever cần connection pool, chỉ dựng được
    sau khi pool sẵn sàng.
    """
    try:
        import app.services.embedding  # noqa: F401
        from app.db.repositories.chunk_repo import ChunkRepository
        from app.services.retriever import HybridRetriever
    except ImportError as exc:
        raise AIDependencyError(
            f"Không dựng được HybridRetriever vì thiếu dependency AI tùy chọn ({exc.name}). "
            f"Cài bằng: {AI_EXTRA_HINT}"
        ) from exc
    return HybridRetriever(ChunkRepository(pool), embedding, settings)


def build_kg_store(pool: Any = None) -> Any:
    """Dựng KnowledgeGraphStore."""
    from app.services.knowledge_graph.store import KnowledgeGraphStore
    return KnowledgeGraphStore(pool)
