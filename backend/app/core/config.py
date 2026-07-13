import os
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, field_validator

class Settings(BaseSettings):
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    FRONTEND_ORIGINS: Union[List[str], str] = "http://localhost:5173,http://127.0.0.1:5173"
    DATABASE_URL: str = "sqlite:///./data/studyrag.db"
    SUPABASE_URL: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = ""
    SUPABASE_SECRET_KEY: str = ""
    VECTOR_STORE_TYPE: str = "sqlite_chroma"  # Hoặc "supabase_pgvector" khi dùng Supabase
    CHROMA_PATH: str = "./data/chroma"
    UPLOAD_DIR: str = "./data/raw"
    PROCESSED_DIR: str = "./data/processed"
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
