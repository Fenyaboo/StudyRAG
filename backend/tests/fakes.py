"""Fake asyncpg pool/connection dùng cho test, không cần database thật."""

from typing import Any


class FakeConnection:
    """Ghi lại mọi câu SQL được gọi và mô phỏng hành vi tối thiểu của asyncpg."""

    def __init__(self, *, fetchval_result: Any = None) -> None:
        self.fetchrow_calls: list[tuple[str, tuple[Any, ...]]] = []
        self.fetchval_calls: list[tuple[str, tuple[Any, ...]]] = []
        self.fetch_calls: list[tuple[str, tuple[Any, ...]]] = []
        self.execute_calls: list[tuple[str, tuple[Any, ...]]] = []
        self.fetchval_result = fetchval_result
        # Cho phép test bắt buộc update_status không khớp row nào.
        self.update_returns_row = True

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        self.fetchrow_calls.append((query, args))
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
        return self.fetchval_result

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        self.fetch_calls.append((query, args))
        return []

    async def execute(self, query: str, *args: Any) -> None:
        self.execute_calls.append((query, args))

    @property
    def status_updates(self) -> list[tuple[str, str | None]]:
        """Danh sách (status, error_message) của mọi lần UPDATE trạng thái."""
        return [
            (args[2], args[5])
            for query, args in self.fetchrow_calls
            if "UPDATE public.documents" in query
        ]


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
