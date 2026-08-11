"""Task 7.4 — stats() phải total. Gồm Property 5 (bảo toàn tổng, không KeyError)."""

import asyncio
from typing import Any
from uuid import uuid4

from hypothesis import given, strategies as st

from app.db.repositories.document_repo import DocumentRepository
from tests.fakes import FakeConnection, FakePool

KNOWN_STATUSES = ("processing", "stored", "ready", "failed", "ocr_required")


class _StatsConnection(FakeConnection):
    """Trả về phân phối status do test quyết định cho câu GROUP BY status."""

    def __init__(self, rows: list[tuple[str, int]]) -> None:
        super().__init__()
        self._rows = rows

    async def fetch(self, query: str, *args: Any) -> list[dict[str, Any]]:
        await super().fetch(query, *args)
        if "GROUP BY status" in query:
            return [{"status": status, "count": count} for status, count in self._rows]
        return []


def _stats(rows: list[tuple[str, int]]) -> dict[str, int]:
    pool = FakePool(_StatsConnection(rows))
    return asyncio.run(DocumentRepository(pool).stats(uuid4()))


def test_stored_is_seeded_even_with_no_rows():
    result = _stats([])
    assert result == {
        "total": 0,
        "ready": 0,
        "stored": 0,
        "processing": 0,
        "failed": 0,
        "ocr_required": 0,
    }


def test_counts_stored_documents():
    result = _stats([("stored", 3), ("ready", 2)])
    assert result["stored"] == 3
    assert result["ready"] == 2
    assert result["total"] == 5


def test_unknown_status_does_not_raise_key_error():
    """Trước khi sửa, `result[key] = count` gây KeyError -> 500 ở /documents/stats."""
    result = _stats([("archived", 4), ("ready", 1)])
    assert result["archived"] == 4
    assert result["total"] == 5


# --- Property 5 -------------------------------------------------------------


@given(
    st.lists(
        st.tuples(
            st.one_of(st.sampled_from(KNOWN_STATUSES), st.sampled_from(["archived", "queued", "x"])),
            st.integers(min_value=0, max_value=10_000),
        ),
        max_size=12,
    )
)
def test_property_stats_is_total_and_sum_preserving(distribution):
    result = _stats(distribution)

    assert result["total"] == sum(count for _, count in distribution)
    assert result["total"] == sum(value for key, value in result.items() if key != "total")
    assert set(KNOWN_STATUSES) <= set(result)
    assert all(value >= 0 for value in result.values())
