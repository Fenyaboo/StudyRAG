import os
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_AI_FLAG_TRUE_VALUES = frozenset({"true", "1", "yes", "on"})
_AI_FLAG_FALSE_VALUES = frozenset({"false", "0", "no", "off"})


def model_cache_dir() -> str | None:
    """Thư mục cache dùng chung cho sentence-transformers và transformers.

    Trả về `SENTENCE_TRANSFORMERS_HOME` nếu có, sau đó `HF_HOME`. Nếu cả hai đều
    không được đặt (thường là khi chạy local) thì trả về None để giữ nguyên hành vi
    cache mặc định của thư viện. Trong container, biến này phải trùng với đường dẫn
    đã tải model lúc build image để không tải lại ~500MB lúc runtime.
    """
    for name in ("SENTENCE_TRANSFORMERS_HOME", "HF_HOME"):
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return None


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
        default="http://localhost:5173,https://examoras.site",
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

    # Object Storage: Hỗ trợ Tencent Cloud COS (S3-compatible) & AWS S3
    s3_bucket_name: str = Field(default="", validation_alias="S3_BUCKET_NAME")
    s3_region: str = Field(default="ap-singapore", validation_alias="S3_REGION")
    s3_endpoint_url: str = Field(default="", validation_alias="S3_ENDPOINT_URL")
    aws_access_key_id: str = Field(default="", validation_alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str = Field(default="", validation_alias="AWS_SECRET_ACCESS_KEY")

    embedding_model: str = Field(
        default="bkai-foundation-models/vietnamese-bi-encoder",
        validation_alias="EMBEDDING_MODEL",
    )
    embedding_dimension: int = Field(default=768, validation_alias="EMBEDDING_DIMENSION")
    embedding_batch_size: int = Field(default=32, validation_alias="EMBEDDING_BATCH_SIZE")

    max_upload_size_bytes: int = Field(default=50 * 1024 * 1024, validation_alias="MAX_UPLOAD_SIZE_BYTES")
    # Thời gian tối đa cho một lượt xử lý (parse + chunk + embed) một tài liệu.
    # Cũng là ngưỡng để job recovery lúc startup coi một document `processing` là đã treo.
    ingest_timeout_seconds: int = Field(default=900, validation_alias="INGEST_TIMEOUT_SECONDS")
    max_retrieval_results: int = Field(default=8, validation_alias="MAX_RETRIEVAL_RESULTS")
    rrf_k: int = Field(default=60, validation_alias="RRF_K")
    chat_rate_limit_per_minute: int = Field(default=30, validation_alias="CHAT_RATE_LIMIT_PER_MINUTE")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")
    # Cờ duy nhất bật/tắt toàn bộ tính năng AI (embedding, hybrid retrieval, chat qua Dify).
    # Giá trị được phân giải một lần cho mỗi tiến trình vì `get_settings()` có lru_cache.
    ai_features_enabled: bool = Field(default=False, validation_alias="AI_FEATURES_ENABLED")

    @field_validator("ai_features_enabled", mode="before")
    @classmethod
    def _parse_ai_features_enabled(cls, value: object) -> bool:
        """Parse AI_FEATURES_ENABLED thành total function trên miền `str | bool | None`.

        Chuỗi rỗng hoặc chỉ có khoảng trắng trả về False; pydantic mặc định coi đây là
        lỗi validate, nên validator này là lý do chính để tồn tại. Giá trị ngoài tập hợp
        lệ raise ValueError nêu tên biến và tập giá trị hợp lệ, thay vì âm thầm dùng
        giá trị mặc định.
        """
        if isinstance(value, bool):
            return value
        if value is None:
            return False
        text = str(value).strip().lower()
        if not text:
            return False
        if text in _AI_FLAG_TRUE_VALUES:
            return True
        if text in _AI_FLAG_FALSE_VALUES:
            return False
        raise ValueError(
            "AI_FEATURES_ENABLED không hợp lệ. Giá trị hợp lệ: "
            "true, 1, yes, on (bật) hoặc false, 0, no, off (tắt)."
        )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]

    @property
    def jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
