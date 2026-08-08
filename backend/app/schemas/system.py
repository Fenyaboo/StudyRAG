from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "studyrag-api"
    version: str = "0.1.0"


class DependencyStatus(BaseModel):
    database: bool
    storage_configured: bool
    # Field mới (không đổi tên field cũ để giữ tương thích): kết quả head_bucket thật sự,
    # vì `storage_configured` chỉ nói bucket có được khai báo hay không.
    storage_reachable: bool = False
    dify_configured: bool
    embedding_configured: bool


class ReadyResponse(BaseModel):
    status: str
    checks: DependencyStatus
    message: str | None = None
