from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "examoras-api"
    version: str = "0.1.0"


class DependencyStatus(BaseModel):
    database: bool
    storage_configured: bool
    # Field mới (không đổi tên field cũ để giữ tương thích): kết quả head_bucket thật sự,
    # vì `storage_configured` chỉ nói bucket có được khai báo hay không.
    storage_reachable: bool = False
    dify_configured: bool
    embedding_configured: bool
    # KHÔNG thêm field mới vào đây nếu nó không phải điều kiện readiness: `system.py`
    # từng tính `all(checks.model_dump().values())`, nên mọi field boolean thêm vào
    # DependencyStatus đều âm thầm gate readiness.


class ReadyResponse(BaseModel):
    status: str
    checks: DependencyStatus
    # Feature_Status_Field: kênh duy nhất frontend dùng để biết trạng thái cờ AI.
    ai_enabled: bool = False
    message: str | None = None
