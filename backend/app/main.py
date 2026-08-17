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
from app.db.repositories.document_repo import DocumentRepository
from app.schemas.system import HealthResponse
from app.services.ai_runtime import build_ai_runtime, build_kg_store, build_retriever
from app.services.pdf_parser import PDFParser
from app.services.rate_limit import InMemoryRateLimiter
from app.services.readiness import evaluate_readiness
from app.services.storage import StorageService

logging.basicConfig(level=getattr(logging, get_settings().log_level.upper(), logging.INFO))
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings
    app.state.ai_enabled = settings.ai_features_enabled
    app.state.storage = StorageService(settings)
    app.state.pdf_parser = PDFParser()
    app.state.rate_limiter = InMemoryRateLimiter(settings.chat_rate_limit_per_minute)
    app.state.dify = None
    app.state.embedding = None
    app.state.chunker = None
    app.state.retriever = None
    app.state.kg_store = build_kg_store()
    if settings.ai_features_enabled:
        ai = build_ai_runtime(settings)
        app.state.dify = ai.dify
        app.state.embedding = ai.embedding
        app.state.chunker = ai.chunker
    app.state.pool = None
    try:
        app.state.pool = await create_pool(settings)
        app.state.kg_store = build_kg_store(app.state.pool)
        if settings.ai_features_enabled:
            app.state.retriever = build_retriever(app.state.pool, app.state.embedding, settings)
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
    logger.info("AI features enabled: %s", settings.ai_features_enabled)
    try:
        yield
    finally:
        await close_pool(app.state.pool)


app = FastAPI(
    title="Examoras API",
    version="0.1.0",
    description="Universal multi-lingual AI exam & study assistant with private-document RAG and Knowledge Graph.",
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
    return JSONResponse({"service": "examoras-api", "docs": "/docs", "health": "/api/v1/health"})


@app.get("/health", include_in_schema=False)
async def root_health() -> JSONResponse:
    # Dùng schema thay vì literal để giá trị không bị hard-code ở hai chỗ.
    return JSONResponse(HealthResponse().model_dump())


@app.get("/ready", include_in_schema=False)
async def root_ready(request: Request) -> JSONResponse:
    # Dùng chung `evaluate_readiness` với /api/v1/ready để hai probe không thể trôi lệch.
    snapshot = await evaluate_readiness(request.app.state)
    return JSONResponse(
        {"status": "ready" if snapshot.ready else "not_ready", "ai_enabled": snapshot.ai_enabled}
    )
