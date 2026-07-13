from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import system, ingest, query

app = FastAPI(
    title="StudyRAG Backend API",
    description="Trợ lý ôn thi từ tài liệu cá nhân lớp 12 — Toán, Lý, Hóa",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Cấu hình CORS cho phép Frontend kết nối
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex="https://.*",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount các Router API V1
app.include_router(system.router, prefix="/api/v1", tags=["system"])
app.include_router(ingest.router, prefix="/api/v1", tags=["ingestion"])
app.include_router(query.router, prefix="/api/v1", tags=["query"])

@app.get("/", tags=["root"])
async def root():
    return {
        "name": "StudyRAG Backend API",
        "version": "2.0.0",
        "status": "online",
        "docs": "/docs",
        "health": "/api/v1/health",
        "ready": "/api/v1/ready"
    }
