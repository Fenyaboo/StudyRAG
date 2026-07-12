from pydantic import BaseModel
from typing import Dict, Any

class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    timestamp: str

class ReadyResponse(BaseModel):
    status: str
    database: str
    vector_store: str
    embedding_provider: str
    llm_provider: str
    details: Dict[str, Any] = {}
