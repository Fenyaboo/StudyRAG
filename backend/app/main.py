import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.db.connection import close_pool, create_pool
from app.db.repositories.chunk_repo import ChunkRepository
from app.db.repositories.document_repo import DocumentRepository
from app.services.chunker import SmartChunker
from app.services.dify import DifyClient
from app.services.embedding import EmbeddingService
from app.services.pdf_parser import PDFParser
from app.services.rate_limit import InMemoryRateLimiter
from app.services.retriever import HybridRetriever
from app.services.storage import StorageService

logging.basicConfig(level=getattr(logging, get_settings().log_level.upper(), logging.INFO))
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings
    app.state.storage = StorageService(settings)
    app.state.dify = DifyClient(settings)
    app.state.embedding = EmbeddingService(settings)
    app.state.pdf_parser = PDFParser()
    app.state.chunker = SmartChunker()
    app.state.rate_limiter = InMemoryRateLimiter(settings.chat_rate_limit_per_minute)
    app.state.pool = None
    try:
        app.state.pool = await create_pool(settings)
        app.state.retriever = HybridRetriever(ChunkRepository(app.state.pool), app.state.embedding, settings)
        logger.info("Database pool initialized")
    except Exception:
        app.state.retriever = None
        logger.exception("Database initialization failed; API will report not_ready")
    if app.state.pool is not None:
        # Job bảo trì: document còn treo `processing` sau khi tiến trình restart sẽ được
        # đánh dấu failed. Lỗi ở đây không được phép làm sập startup.
        try:
            recovered = await DocumentRepository(app.state.pool).fail_stale_processing(
                older_than_seconds=settings.ingest_timeout_seconds
            )
            if recovered:
                logger.warning("Đã đánh dấu failed cho %s document treo ở processing", recovered)
        except Exception:
            logger.exception("Startup recovery cho document treo ở processing thất bại; bỏ qua")
    try:
        yield
    finally:
        await close_pool(app.state.pool)


app = FastAPI(
    title="StudyRAG API",
    version="0.1.0",
    description="Vietnamese exam-study assistant with private-document RAG.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_exception_handlers(app)
app.include_router(api_router, prefix="/api/v1")


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.get("/", include_in_schema=False)
async def root() -> JSONResponse:
    return JSONResponse({"service": "studyrag-api", "docs": "/docs", "health": "/api/v1/health"})


@app.get("/health", include_in_schema=False)
async def root_health() -> JSONResponse:
    return JSONResponse({"status": "ok", "service": "studyrag-api", "version": "0.1.0"})


@app.get("/ready", include_in_schema=False)
async def root_ready(request: Request) -> JSONResponse:
    database = bool(getattr(request.app.state, "pool", None))
    storage = request.app.state.storage
    configured = storage.configured and request.app.state.dify.configured and request.app.state.embedding.configured
    # Nhất quán với /api/v1/ready: kiểm tra S3 thật sự truy cập được (có cache 30s).
    storage_reachable = await storage.check_cached() if storage.configured else False
    ready = database and configured and storage_reachable
    return JSONResponse({"status": "ready" if ready else "not_ready"})
