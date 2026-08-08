from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        # Supports both `uvicorn --app-dir backend` from the repo root and
        # running the process with backend/ as its working directory.
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = Field(default="development", validation_alias="APP_ENV")
    frontend_origins: str = Field(
        default="http://localhost:5173",
        validation_alias="FRONTEND_ORIGINS",
    )
    database_url: str = Field(default="", validation_alias="DATABASE_URL")

    supabase_url: str = Field(default="", validation_alias="SUPABASE_URL")
    supabase_anon_key: str = Field(default="", validation_alias="SUPABASE_ANON_KEY")
    supabase_service_role_key: str = Field(default="", validation_alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_jwt_issuer: str = Field(default="", validation_alias="SUPABASE_JWT_ISSUER")
    supabase_jwt_secret: str = Field(default="", validation_alias="SUPABASE_JWT_SECRET")

    dify_api_base_url: str = Field(default="https://api.dify.ai/v1", validation_alias="DIFY_API_BASE_URL")
    dify_api_key: str = Field(default="", validation_alias="DIFY_API_KEY")
    dify_timeout_seconds: float = Field(default=120.0, validation_alias="DIFY_TIMEOUT_SECONDS")

    s3_bucket_name: str = Field(default="", validation_alias="S3_BUCKET_NAME")
    s3_region: str = Field(default="ap-southeast-1", validation_alias="S3_REGION")
    aws_access_key_id: str = Field(default="", validation_alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str = Field(default="", validation_alias="AWS_SECRET_ACCESS_KEY")

    embedding_model: str = Field(
        default="bkai-foundation-models/vietnamese-bi-encoder",
        validation_alias="EMBEDDING_MODEL",
    )
    embedding_dimension: int = Field(default=768, validation_alias="EMBEDDING_DIMENSION")
    embedding_batch_size: int = Field(default=32, validation_alias="EMBEDDING_BATCH_SIZE")

    max_upload_size_bytes: int = Field(default=50 * 1024 * 1024, validation_alias="MAX_UPLOAD_SIZE_BYTES")
    max_retrieval_results: int = Field(default=8, validation_alias="MAX_RETRIEVAL_RESULTS")
    rrf_k: int = Field(default=60, validation_alias="RRF_K")
    chat_rate_limit_per_minute: int = Field(default=30, validation_alias="CHAT_RATE_LIMIT_PER_MINUTE")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]

    @property
    def jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
