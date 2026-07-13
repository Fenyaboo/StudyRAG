import os
import json
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


def _default_data_dir() -> Path:
    """Use one persistent data directory regardless of the current working directory."""
    configured_path = os.getenv("DATA_DIR")
    if configured_path:
        return Path(configured_path).expanduser().resolve()

    backend_dir = Path(__file__).resolve().parents[2]
    return (backend_dir.parent / "data").resolve()


DEFAULT_DATA_DIR = _default_data_dir()

class Settings(BaseSettings):
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    FRONTEND_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    DATA_DIR: str = str(DEFAULT_DATA_DIR)
    DATABASE_URL: str = f"sqlite:///{DEFAULT_DATA_DIR / 'studyrag.db'}"
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_ISSUER: str = ""
    SUPABASE_JWT_AUDIENCE: str = "authenticated"
    VECTOR_STORE_TYPE: str = "sqlite_chroma"  # Hoặc "supabase_pgvector" khi dùng Supabase
    CHROMA_PATH: str = str(DEFAULT_DATA_DIR / "chroma")
    UPLOAD_DIR: str = str(DEFAULT_DATA_DIR / "raw")
    PROCESSED_DIR: str = str(DEFAULT_DATA_DIR / "processed")
    MAX_UPLOAD_MB: int = 25
    EMBEDDING_PROVIDER: str = "sentence_transformers"
    EMBEDDING_MODEL: str = "bkai-foundation-models/vietnamese-bi-encoder"
    LLM_PROVIDER: str = "ollama"  # Hoặc "gemini", "nvidia", "openai"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:7b"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"
    NVIDIA_API_KEY: str = ""
    NVIDIA_MODEL: str = "z-ai/glm-5.2"
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    RETRIEVAL_TOP_K: int = 5
    RETRIEVAL_MIN_SCORE: float = 0.25
    LOG_LEVEL: str = "INFO"

    @field_validator("FRONTEND_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, value: Any) -> list[str]:
        if isinstance(value, str):
            raw_value = value.strip()
            if not raw_value:
                raise ValueError("FRONTEND_ORIGINS must not be empty")
            if raw_value.startswith("["):
                try:
                    origins = json.loads(raw_value)
                except json.JSONDecodeError as error:
                    raise ValueError("FRONTEND_ORIGINS must be valid JSON or CSV") from error
                if not isinstance(origins, list):
                    raise ValueError("FRONTEND_ORIGINS JSON value must be an array")
            else:
                origins = raw_value.split(",")
        elif isinstance(value, (list, tuple)):
            origins = list(value)
        else:
            raise ValueError("FRONTEND_ORIGINS must be a JSON array or CSV string")

        if not origins:
            raise ValueError("FRONTEND_ORIGINS must include at least one origin")

        normalized_origins: list[str] = []
        for origin in origins:
            if not isinstance(origin, str) or not origin.strip():
                raise ValueError("Each FRONTEND_ORIGINS entry must be a non-empty string")
            parsed = urlsplit(origin.strip())
            try:
                parsed.port
            except ValueError as error:
                raise ValueError(f"Invalid FRONTEND_ORIGINS entry: {origin}") from error
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or "*" in parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.query
                or parsed.fragment
                or parsed.path not in {"", "/"}
                or parsed.netloc.endswith(":")
            ):
                raise ValueError(f"Invalid FRONTEND_ORIGINS entry: {origin}")
            normalized_origins.append(f"{parsed.scheme}://{parsed.netloc}")

        return normalized_origins

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
        enable_decoding=False,
    )

settings = Settings()
