"""Task 8.4 — Storage_Only_Ingest. Gồm Property 3 (trạng thái terminal) và Property 4."""

import asyncio
from types import SimpleNamespace
from uuid import uuid4

from hypothesis import given, settings as hypothesis_settings, strategies as st

from app.api.v1.documents import _process_document, _run_ingest_pipeline
from tests.fakes import FakeConnection, FakePool

TERMINAL_DISABLED = {"stored", "ocr_required", "failed"}


def _parsed(*, requires_ocr=False, page_count=2):
    return SimpleNamespace(
        requires_ocr=requires_ocr,
        page_count=page_count,
        pages=[SimpleNamespace(page_number=1, text="nội dung")],
    )


def _request(pool, *, ai_enabled=False, parse=None, timeout=30):
    """State cho pipeline. chunker/embedding để None: nhánh tắt không được phép chạm."""
    state = SimpleNamespace(
        ai_enabled=ai_enabled,
        pool=pool,
        settings=SimpleNamespace(ingest_timeout_seconds=timeout),
        pdf_parser=SimpleNamespace(parse=parse or (lambda content: _parsed())),
        chunker=None,
        embedding=None,
    )
    return SimpleNamespace(app=SimpleNamespace(state=state))


async def _run(pool, **kwargs):
    await _process_document(
        request=_request(pool, **kwargs),
        owner_id=uuid4(),
        document_id=uuid4(),
        content=b"%PDF-1.7 fake",
        doc_type="exam",
    )


async def test_text_pdf_becomes_stored_with_zero_chunks():
    pool = FakePool()
    await _run(pool)

    records = pool.status_update_records
    assert [record["status"] for record in records] == ["stored"]
    assert records[0]["chunk_count"] == 0
    assert records[0]["page_count"] == 2
    assert records[0]["error_message"] is None


async def test_no_chunk_or_embedding_call_and_no_chunk_writes():
    pool = FakePool()
    await _run(pool)
    assert pool.chunk_write_statements == []
    # chunker/embedding là None; nếu pipeline chạm chúng sẽ là AttributeError.


async def test_image_only_pdf_still_becomes_ocr_required():
    pool = FakePool()
    await _run(pool, parse=lambda content: _parsed(requires_ocr=True))

    records = pool.status_update_records
    assert [record["status"] for record in records] == ["ocr_required"]
    assert records[0]["chunk_count"] == 0
    assert "OCR" in records[0]["error_message"]


async def test_parser_failure_becomes_failed_with_truncated_message():
    pool = FakePool()

    def broken_parse(content):
        raise ValueError("x" * 5000)

    await _run(pool, parse=broken_parse)

    records = pool.status_update_records
    assert records[-1]["status"] == "failed"
    assert len(records[-1]["error_message"]) <= 1000


async def test_stored_branch_stays_inside_the_timeout_wrapper(monkeypatch):
    """Hồi quy: nhánh stored phải nằm trong `_run_ingest_pipeline`.

    Nếu một lần refactor đưa nhánh này ra `ingest_document` thành task riêng, nó sẽ
    không còn được `asyncio.wait_for` của `_process_document` bảo vệ. Test thay pipeline
    bằng một coroutine chậm và khẳng định wrapper vẫn chuyển sang `failed` vì timeout.
    """
    import app.api.v1.documents as documents_module

    pool = FakePool()

    async def slow_pipeline(**kwargs):
        await asyncio.sleep(0.5)

    monkeypatch.setattr(documents_module, "_run_ingest_pipeline", slow_pipeline)

    await _run(pool, timeout=0.05)

    records = pool.status_update_records
    assert records[-1]["status"] == "failed"
    assert "vượt quá" in records[-1]["error_message"]


async def test_enabled_mode_still_reaches_ready():
    """Đường lập chỉ mục không bị nhánh tắt chặn."""
    pool = FakePool()
    chunk = SimpleNamespace(id="chunk-1", content="nội dung", metadata={"page": 1})
    state = SimpleNamespace(
        ai_enabled=True,
        pool=pool,
        settings=SimpleNamespace(ingest_timeout_seconds=30),
        pdf_parser=SimpleNamespace(parse=lambda content: _parsed()),
        chunker=SimpleNamespace(build=lambda *args, **kwargs: [chunk]),
        embedding=SimpleNamespace(encode=lambda texts: _vectors(texts)),
    )
    request = SimpleNamespace(app=SimpleNamespace(state=state))

    await _run_ingest_pipeline(
        request=request,
        owner_id=uuid4(),
        document_id=uuid4(),
        content=b"%PDF-1.7 fake",
        doc_type="exam",
    )

    records = pool.status_update_records
    assert records[-1]["status"] == "ready"
    assert records[-1]["chunk_count"] == 1


async def _vectors(texts):
    return [[0.0, 0.0, 0.0] for _ in texts]


# --- Property 3 & Property 4 ------------------------------------------------


def _parse_behaviours():
    def ok(content):
        return _parsed()

    def ocr(content):
        return _parsed(requires_ocr=True)

    def zero_pages(content):
        return _parsed(page_count=0)

    def raises(content):
        raise RuntimeError("parse lỗi")

    def returns_garbage(content):
        raise AttributeError("thiếu attribute")

    return st.sampled_from([ok, ocr, zero_pages, raises, returns_garbage])


@hypothesis_settings(max_examples=40, deadline=None)
@given(parse=_parse_behaviours(), content=st.binary(max_size=32))
def test_property_disabled_ingest_reaches_exactly_one_terminal_state(parse, content):
    pool = FakePool(FakeConnection())

    async def run():
        await _process_document(
            request=_request(pool, parse=parse),
            owner_id=uuid4(),
            document_id=uuid4(),
            content=content,
            doc_type="exam",
        )

    asyncio.run(run())

    records = pool.status_update_records
    statuses = [record["status"] for record in records]

    # Property 3: đúng một trạng thái terminal, không bao giờ `ready`, chunk_count luôn 0.
    terminals = [status for status in statuses if status in TERMINAL_DISABLED | {"ready"}]
    assert len(terminals) == 1
    assert terminals[0] in TERMINAL_DISABLED
    assert "ready" not in statuses
    assert all((record["chunk_count"] or 0) == 0 for record in records)

    # Property 4: không mutation nào trên document_chunks, bất kể input.
    assert pool.chunk_write_statements == []
