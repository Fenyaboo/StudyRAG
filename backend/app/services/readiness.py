"""Tính readiness dùng chung cho cả hai probe `/ready`.

Trả về dataclass thay vì Pydantic schema: `services/` không sở hữu hợp đồng wire,
route chịu trách nhiệm map sang schema.
"""

from dataclasses import dataclass
from typing import Any

from app.db.connection import check_database


@dataclass(frozen=True, slots=True)
class ReadinessSnapshot:
    database: bool
    storage_configured: bool
    storage_reachable: bool
    dify_configured: bool
    embedding_configured: bool
    ai_enabled: bool

    @property
    def ready(self) -> bool:
        """`dify_configured`/`embedding_configured` chỉ tham gia khi AI đang bật.

        Cố tình chọn field tường minh thay vì `all(...)` trên toàn bộ model: phép AND mù
        khiến mọi field boolean thêm vào sau này tự động gate readiness.
        """
        core = self.database and self.storage_configured and self.storage_reachable
        if not self.ai_enabled:
            return core
        return core and self.dify_configured and self.embedding_configured


async def evaluate_readiness(state: Any) -> ReadinessSnapshot:
    database = await check_database(getattr(state, "pool", None))
    storage = getattr(state, "storage", None)
    storage_configured = bool(getattr(storage, "configured", False))
    # Readiness phải phản ánh khả năng truy cập S3 thật (credentials/quyền), không chỉ
    # việc bucket đã được khai báo. Kết quả được cache ngắn ở StorageService.
    storage_reachable = await storage.check_cached() if storage_configured else False
    return ReadinessSnapshot(
        database=database,
        storage_configured=storage_configured,
        storage_reachable=bool(storage_reachable),
        # Ở AI_Disabled_Mode hai service này là None, nên phải bọc getattr hai lớp.
        dify_configured=bool(getattr(getattr(state, "dify", None), "configured", False)),
        embedding_configured=bool(getattr(getattr(state, "embedding", None), "configured", False)),
        ai_enabled=bool(getattr(state, "ai_enabled", False)),
    )
