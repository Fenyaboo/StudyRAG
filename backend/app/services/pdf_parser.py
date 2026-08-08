from dataclasses import dataclass

import fitz


@dataclass(frozen=True)
class PageText:
    page_number: int
    text: str


@dataclass(frozen=True)
class ParsedDocument:
    pages: list[PageText]
    page_count: int
    requires_ocr: bool


class PDFParser:
    def parse(self, content: bytes) -> ParsedDocument:
        try:
            pdf = fitz.open(stream=content, filetype="pdf")
        except (fitz.FileDataError, ValueError) as exc:
            raise ValueError("File không phải PDF hợp lệ") from exc

        pages: list[PageText] = []
        try:
            for index, page in enumerate(pdf):
                text = page.get_text("text", sort=True).strip()
                pages.append(PageText(page_number=index + 1, text=text))
        finally:
            pdf.close()

        if not pages:
            raise ValueError("PDF không có trang")
        text_pages = sum(bool(page.text.strip()) for page in pages)
        total_chars = sum(len(page.text) for page in pages)
        requires_ocr = text_pages == 0 or (text_pages / len(pages) < 0.25) or total_chars < len(pages) * 20
        return ParsedDocument(pages=pages, page_count=len(pages), requires_ocr=requires_ocr)
