from uuid import uuid4

from app.services.chunker import SmartChunker


def test_chunker_preserves_page_metadata(fake_pages):
    chunks = SmartChunker(max_tokens=30).build(uuid4(), fake_pages, doc_type="textbook")
    assert chunks
    assert {chunk.metadata["page"] for chunk in chunks} == {1, 2}
    assert all(chunk.metadata["document_type"] == "textbook" for chunk in chunks)
    assert all(chunk.content for chunk in chunks)


def test_chunker_splits_long_text():
    from app.services.pdf_parser import PageText

    page = PageText(page_number=3, text=" ".join(["năng lượng"] * 100))
    chunks = SmartChunker(max_tokens=12, overlap_tokens=2).build(uuid4(), [page], doc_type="exam")
    assert len(chunks) > 1
    assert all(chunk.metadata["token_count"] <= 12 for chunk in chunks)
