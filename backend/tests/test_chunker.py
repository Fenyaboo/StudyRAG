from uuid import uuid4

from app.services.chunker import SmartChunker
from tests.conftest import requires_ai_dependencies


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


def test_token_count_falls_back_to_word_count_without_tokenizer():
    """Task 4.5 — chunker thoái giảm êm khi thiếu `transformers`.

    `_get_tokenizer()` bắt mọi Exception và set `_tokenizer = False`, sau đó `token_count`
    đếm theo whitespace. Buộc `_tokenizer = False` để test tất định ở cả hai môi trường.
    """
    chunker = SmartChunker()
    chunker._tokenizer = False

    assert chunker.token_count("năng lượng cơ học") == 4
    assert chunker.token_count("   ") == 1  # luôn tối thiểu 1 token
    assert chunker._word_token_counts(["a", "b", "c"]) == [1, 1, 1]


def test_chunker_still_produces_chunks_without_tokenizer(fake_pages):
    """Thiếu tokenizer làm biên chunk dịch chuyển nhưng không được raise."""
    chunker = SmartChunker(max_tokens=10, overlap_tokens=2)
    chunker._tokenizer = False

    chunks = chunker.build(uuid4(), fake_pages, doc_type="textbook")
    assert chunks
    assert all(chunk.metadata["token_count"] <= 10 for chunk in chunks)


@requires_ai_dependencies
def test_real_tokenizer_is_used_when_ml_dependencies_are_installed():
    """Chốt hồi quy cho rủi ro R5.

    Nếu bật lại AI mà thiếu `transformers`, chunker vẫn chạy nhưng tạo chunk có biên khác
    so với chunk cũ trong cùng database. Test này làm lỗi cấu hình đó lộ ra ở test thay vì
    ở dữ liệu.
    """
    chunker = SmartChunker()
    assert chunker._get_tokenizer() is not False
