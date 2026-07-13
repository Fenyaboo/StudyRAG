import os
from pathlib import Path
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, field_validator


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
    FRONTEND_ORIGINS: Union[List[str], str] = "http://localhost:5173,http://127.0.0.1:5173"
    DATA_DIR: str = str(DEFAULT_DATA_DIR)
    DATABASE_URL: str = f"sqlite:///{DEFAULT_DATA_DIR / 'studyrag.db'}"
    SUPABASE_URL: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = ""
    SUPABASE_SECRET_KEY: str = ""
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
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, tuple)):
            return [str(item) for item in v]
        return ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
