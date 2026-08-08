import fitz

from app.services.pdf_parser import PDFParser


def make_pdf(text: str) -> bytes:
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), text)
    data = document.tobytes()
    document.close()
    return data


def test_parser_extracts_text_and_page_count():
    parsed = PDFParser().parse(make_pdf("StudyRAG kiểm tra nội dung PDF."))
    assert parsed.page_count == 1
    assert parsed.pages[0].page_number == 1
    assert "StudyRAG" in parsed.pages[0].text
    assert parsed.requires_ocr is False


def test_parser_flags_image_only_like_pdf():
    parsed = PDFParser().parse(make_pdf(""))
    assert parsed.requires_ocr is True
