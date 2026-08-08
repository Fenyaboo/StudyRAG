from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "studyrag-api"
    version: str = "0.1.0"


class DependencyStatus(BaseModel):
    database: bool
    storage_configured: bool
    dify_configured: bool
    embedding_configured: bool


class ReadyResponse(BaseModel):
    status: str
    checks: DependencyStatus
    message: str | None = None
