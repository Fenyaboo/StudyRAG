import pytest
import io
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.services.pdf_parser import parse_pdf_bytes, OCRRequiredException, PDFParseException
from app.services.chunker import chunk_exam_document, chunk_textbook_document

def test_pdf_parser_empty_or_invalid():
    with pytest.raises(PDFParseException):
        parse_pdf_bytes(b"invalid bytes not a pdf", filename="bad.pdf")

def test_chunk_exam_document_regex():
    # Giả lập 2 trang PDF chứa đề thi
    pages = [
        {
            "page_number": 1,
            "content": "SỞ GIÁO DỤC VÀ ĐÀO TẠO\nĐỀ THI THỬ THPT QUỐC GIA\n\nCâu 1: Hàm số nào sau đây đồng biến trên R?\nA. y = x^3 + x\nB. y = x^2\nC. y = 1/x\nD. y = x^4\n\nCâu 2: Đạo hàm của hàm số y = sin(x) là:\nA. cos(x)\nB. -cos(x)\nC. tan(x)\nD. -sin(x)"
        },
        {
            "page_number": 2,
            "content": "Câu 3: Tính tích phân từ 0 đến 1 của x dx.\nA. 1/2\nB. 1\nC. 2\nD. 0"
        }
    ]
    
    chunks = chunk_exam_document(pages, document_id="test_doc_123")
    assert len(chunks) >= 3
    # Kiểm tra metadata từng câu hỏi
    q1_chunk = next(c for c in chunks if c["metadata"]["question_number"] == "1")
    assert "Hàm số nào sau đây đồng biến" in q1_chunk["content"]
    assert q1_chunk["metadata"]["is_exam_question"] is True
    assert q1_chunk["metadata"]["page_number"] == 1

@pytest.mark.asyncio
async def test_ingest_endpoint_invalid_file_type():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/ingest",
            files={"file": ("test.txt", b"Hello world", "text/plain")}
        )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_FILE_TYPE"

@pytest.mark.asyncio
async def test_get_documents_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/documents")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
