"""Fake dùng cho test: asyncpg pool/connection, storage, Dify và embedding service.

Không test nào cần Supabase, S3, Dify hay endpoint embedding thật.
"""

from typing import Any


class FakeConnection:
    """Ghi lại mọi câu SQL được gọi và mô phỏng hành vi tối thiểu của asyncpg."""

    def __init__(self, *, fetchval_result: Any = None) -> None:
        self.fetchrow_calls: list[tuple[str, tuple[Any, ...]]] = []
        self.fetchval_calls: list[tuple[str, tuple[Any, ...]]] = []
        self.fetch_calls: list[tuple[str, tuple[Any, ...]]] = []
        self.execute_calls: list[tuple[str, tuple[Any, ...]]] = []
        self.executemany_calls: list[tuple[str, list[Any]]] = []
        self.transaction_count = 0
        # Mọi câu SQL đã thực thi, theo đúng thứ tự, bất kể qua method nào. Dùng cho các
        # tính chất kiểm tra trên chuỗi lệnh (ví dụ "không ghi document_chunks"), vì kiểm
        # trên chuỗi lệnh bắt được cả câu ghi bị rollback.
        self.executed_statements: list[str] = []
        self.fetchval_result = fetchval_result
        # Cho phép test bắt buộc update_status không khớp row nào.
        self.update_returns_row = True

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        self.fetchrow_calls.append((query, args))
        self.executed_statements.append(query)
        if "INSERT INTO public.documents" in query:
            # Mô phỏng Postgres: id trong RETURNING là id đã được chèn.
            return {
                "id": args[0],
                "title": args[3],
                "filename": args[4],
                "file_size_bytes": args[6],
                "subject": args[7],
                "doc_type": args[8],
                "status": "processing",
                "page_count": None,
                "chunk_count": None,
                "error_message": None,
                "created_at": None,
                "updated_at": None,
                "storage_key": args[2],
            }
        if "UPDATE public.documents" in query:
            if not self.update_returns_row:
                return None
            return {"id": args[1], "status": args[2], "error_message": args[5]}
        return None

    async def fetchval(self, query: str, *args: Any) -> Any:
        self.fetchval_calls.append((query, args))
        self.executed_statements.append(query)
        # Kiểm tra quyền sở hữu trong ChunkRepository.replace_for_document: trả về truthy
        # để đường lập chỉ mục đi tiếp, nếu không repository raise ValueError.
        if "SELECT 1 FROM public.documents" in query:
            return 1
        return self.fetchval_result

    async def executemany(self, query: str, args_iterable: Any) -> None:
        rows = list(args_iterable)
        self.executemany_calls.append((query, rows))
        self.executed_statements.append(query)

    def transaction(self) -> "_Transaction":
        self.transaction_count += 1
        return _Transaction()

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        self.fetch_calls.append((query, args))
        self.executed_statements.append(query)
        return []

    async def execute(self, query: str, *args: Any) -> None:
        self.execute_calls.append((query, args))
        self.executed_statements.append(query)

    @property
    def status_updates(self) -> list[tuple[str, str | None]]:
        """Danh sách (status, error_message) của mọi lần UPDATE trạng thái."""
        return [
            (args[2], args[5])
            for query, args in self.fetchrow_calls
            if "UPDATE public.documents" in query
        ]

    @property
    def status_update_records(self) -> list[dict[str, Any]]:
        """Chi tiết từng lần UPDATE trạng thái, gồm cả page_count và chunk_count."""
        return [
            {
                "status": args[2],
                "page_count": args[3],
                "chunk_count": args[4],
                "error_message": args[5],
            }
            for query, args in self.fetchrow_calls
            if "UPDATE public.documents" in query
        ]

    @property
    def chunk_write_statements(self) -> list[str]:
        """Các câu lệnh ghi (INSERT/UPDATE/DELETE) chạm bảng document_chunks."""
        return [
            query
            for query in self.executed_statements
            if "document_chunks" in query
            and any(verb in query.upper() for verb in ("INSERT", "UPDATE", "DELETE"))
        ]


class _Transaction:
    """asyncpg transaction giả: chỉ cần là async context manager."""

    async def __aenter__(self) -> "_Transaction":
        return self

    async def __aexit__(self, *exc_info: Any) -> bool:
        return False


class _Acquire:
    def __init__(self, connection: FakeConnection) -> None:
        self._connection = connection

    async def __aenter__(self) -> FakeConnection:
        return self._connection

    async def __aexit__(self, *exc_info: Any) -> bool:
        return False


class FakePool:
    def __init__(self, connection: FakeConnection | None = None) -> None:
        self.connection = connection or FakeConnection()

    def acquire(self) -> _Acquire:
        return _Acquire(self.connection)

    @property
    def executed_statements(self) -> list[str]:
        return self.connection.executed_statements

    @property
    def status_updates(self) -> list[tuple[str, str | None]]:
        return self.connection.status_updates

    @property
    def status_update_records(self) -> list[dict[str, Any]]:
        return self.connection.status_update_records

    @property
    def chunk_write_statements(self) -> list[str]:
        return self.connection.chunk_write_statements


class FakeStorage:
    """StorageService giả: cấu hình xong và truy cập được, đếm số lần gọi."""

    def __init__(self, *, configured: bool = True, reachable: bool = True) -> None:
        self.configured = configured
        self._reachable = reachable
        self.uploads: list[tuple[str, int]] = []
        self.deletes: list[str] = []

    async def check_cached(self) -> bool:
        return self._reachable

    async def upload_pdf(self, key: str, content: bytes) -> None:
        self.uploads.append((key, len(content)))

    async def delete(self, key: str) -> None:
        self.deletes.append(key)

    async def presigned_url(self, key: str, *, expires_in: int) -> str:
        return f"https://example.invalid/{key}?expires_in={expires_in}"


class FakeDify:
    """DifyClient giả: đếm số lần stream_chat để khẳng định 0 request ở chế độ tắt."""

    def __init__(self, *, configured: bool = True) -> None:
        self.configured = configured
        self.call_count = 0

    async def stream_chat(self, **kwargs: Any):
        self.call_count += 1
        if False:  # pragma: no cover - giữ hàm là async generator
            yield None


class FakeEmbedding:
    """EmbeddingService giả: đếm số lần encode và trả vector cố định 3 chiều."""

    def __init__(self, *, configured: bool = True, dimension: int = 3) -> None:
        self.configured = configured
        self.dimension = dimension
        self.call_count = 0

    async def encode(self, texts: list[str]) -> list[list[float]]:
        self.call_count += 1
        return [[0.0] * self.dimension for _ in texts]
