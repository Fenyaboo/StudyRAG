import asyncio
import logging
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.api.v1.documents import _process_document, _set_status
from app.db.repositories.document_repo import DocumentRepository
from tests.fakes import FakeConnection, FakePool


def _normalize(sql: str) -> str:
    return " ".join(sql.split())


async def test_create_inserts_explicit_document_id():
    """FIX 1: id của row phải là id do caller sinh (dùng cho storage_key và background task)."""
    connection = FakeConnection()
    owner_id = uuid4()
    document_id = uuid4()

    record = await DocumentRepository(FakePool(connection)).create(
        owner_id,
        document_id=document_id,
        storage_key=f"users/{owner_id}/documents/{document_id}/de-thi.pdf",
        title="de-thi",
        filename="de-thi.pdf",
        file_hash="a" * 64,
        file_size_bytes=1234,
        subject="Lý",
        doc_type="exam",
    )

    query, args = connection.fetchrow_calls[0]
    normalized = _normalize(query)
    assert "(id, owner_id, storage_key" in normalized
    assert "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)" in normalized
    assert args[0] == document_id
    assert args[1] == owner_id
    assert record["id"] == document_id
    assert record["storage_key"].endswith(f"{document_id}/de-thi.pdf")


async def test_create_requires_document_id():
    with pytest.raises(TypeError):
        await DocumentRepository(FakePool()).create(
            uuid4(),
            storage_key="k",
            title="t",
            filename="f.pdf",
            file_hash="h",
            file_size_bytes=1,
            subject="Chung",
            doc_type="exam",
        )


async def test_set_status_logs_when_no_row_matches(caplog):
    """FIX 2: update không khớp row nào phải log error thay vì im lặng."""
    connection = FakeConnection()
    connection.update_returns_row = False
    document_id = uuid4()

    with caplog.at_level(logging.ERROR, logger="app.api.v1.documents"):
        updated = await _set_status(
            DocumentRepository(FakePool(connection)),
            uuid4(),
            document_id,
            status="failed",
            error_message="boom",
        )

    assert updated is False
    assert any(str(document_id) in record.getMessage() for record in caplog.records)


async def test_set_status_returns_true_when_row_updated():
    connection = FakeConnection()
    updated = await _set_status(
        DocumentRepository(FakePool(connection)),
        uuid4(),
        uuid4(),
        status="ready",
        chunk_count=3,
    )
    assert updated is True
    assert connection.status_updates == [("ready", None)]


def _fake_request(pool: FakePool, *, timeout: float, encode) -> SimpleNamespace:
    parsed = SimpleNamespace(
        requires_ocr=False,
        page_count=1,
        pages=[SimpleNamespace(page_number=1, text="nội dung")],
    )
    chunk = SimpleNamespace(id="chunk-1", content="nội dung", metadata={"page": 1})
    state = SimpleNamespace(
        pool=pool,
        settings=SimpleNamespace(ingest_timeout_seconds=timeout),
        pdf_parser=SimpleNamespace(parse=lambda content: parsed),
        chunker=SimpleNamespace(build=lambda *args, **kwargs: [chunk]),
        embedding=SimpleNamespace(encode=encode),
    )
    return SimpleNamespace(app=SimpleNamespace(state=state))


async def test_process_document_marks_failed_on_timeout():
    """FIX 3: quá thời gian cho phép thì document phải chuyển sang failed, không treo processing."""
    connection = FakeConnection()

    async def slow_encode(texts):
        await asyncio.sleep(5)
        return [[0.0, 0.0, 0.0] for _ in texts]

    request = _fake_request(FakePool(connection), timeout=0.05, encode=slow_encode)
    await _process_document(
        request=request,
        owner_id=uuid4(),
        document_id=uuid4(),
        content=b"%PDF-1.4",
        doc_type="exam",
    )

    assert len(connection.status_updates) == 1
    status, error_message = connection.status_updates[0]
    assert status == "failed"
    assert "vượt quá" in (error_message or "")


async def test_process_document_marks_failed_on_error():
    connection = FakeConnection()

    async def broken_encode(texts):
        raise RuntimeError("embedding sập")

    request = _fake_request(FakePool(connection), timeout=30, encode=broken_encode)
    await _process_document(
        request=request,
        owner_id=uuid4(),
        document_id=uuid4(),
        content=b"%PDF-1.4",
        doc_type="exam",
    )

    assert connection.status_updates == [("failed", "embedding sập")]


async def test_fail_stale_processing_only_touches_stale_processing_rows():
    """FIX 3: job recovery lúc startup chỉ chuyển processing -> failed theo mốc thời gian."""
    connection = FakeConnection(fetchval_result=2)

    recovered = await DocumentRepository(FakePool(connection)).fail_stale_processing(
        older_than_seconds=900
    )

    assert recovered == 2
    query, args = connection.fetchval_calls[0]
    normalized = _normalize(query)
    assert "UPDATE public.documents" in normalized
    assert "SET status='failed'" in normalized
    assert "WHERE status='processing'" in normalized
    assert "updated_at < now() - make_interval" in normalized
    assert args[0] == 900.0
    # Không trả về dữ liệu của owner nào, chỉ đếm số row.
    assert "RETURNING 1" in normalized
