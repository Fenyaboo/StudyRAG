import fitz  # PyMuPDF
import unicodedata
import re
from typing import List, Dict, Any

class OCRRequiredException(Exception):
    """Được ném ra khi tài liệu PDF dạng scan ảnh hoặc có trên 80% trang trống không có văn bản."""
    def __init__(self, message: str = "PDF gần như không có lớp văn bản (cần OCR).", details: dict = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

class PDFParseException(Exception):
    """Được ném ra khi file PDF bị hỏng, mã hóa bảo vệ, hoặc định dạng không hợp lệ."""
    def __init__(self, message: str = "Không thể phân tích cấu trúc file PDF."):
        super().__init__(message)
        self.message = message

def clean_and_normalize_text(text: str) -> str:
    """Chuẩn hóa Unicode NFC, loại bỏ ký tự điều khiển thừa và chuẩn hóa khoảng trắng."""
    if not text:
        return ""
    # Chuẩn hóa Unicode NFC cho tiếng Việt
    text = unicodedata.normalize("NFC", text)
    # Thay thế các tab hay nhiều xuống dòng liên tiếp thành chuẩn
    text = re.sub(r'\r\n', '\n', text)
    text = re.sub(r'\t', ' ', text)
    # Giữ nguyên cấu trúc dòng cho công thức và lựa chọn A/B/C/D nhưng loại bỏ khoảng trắng thừa ở đuôi dòng
    lines = [line.strip() for line in text.split('\n')]
    # Hợp nhất các dòng trống liên tiếp (> 2 dòng trống thành 1 dòng trống)
    cleaned_lines = []
    blank_count = 0
    for line in lines:
        if not line:
            blank_count += 1
            if blank_count <= 1:
                cleaned_lines.append("")
        else:
            blank_count = 0
            cleaned_lines.append(line)
    return "\n".join(cleaned_lines).strip()

def parse_pdf_bytes(pdf_bytes: bytes, filename: str = "document.pdf") -> Dict[str, Any]:
    """
    Phân tích file PDF từ mảng bytes:
    - Trích xuất văn bản từng trang
    - Theo dõi page_number
    - Phát hiện tài liệu cần OCR (> 80% trang trống)
    """
    if not pdf_bytes or not pdf_bytes.startswith(b'%PDF'):
        raise PDFParseException("File không có header chuẩn %PDF hợp lệ.")

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise PDFParseException(f"Không thể mở file PDF bằng PyMuPDF: {str(e)}")

    page_count = len(doc)
    if page_count == 0:
        raise PDFParseException("File PDF không có trang nào.")

    pages_data = []
    empty_pages_count = 0

    for idx in range(page_count):
        try:
            page = doc[idx]
            raw_text = page.get_text("text")
            cleaned_text = clean_and_normalize_text(raw_text)
            char_count = len(cleaned_text)

            if char_count < 20:  # Trang gần như trống hoặc ảnh scan không text
                empty_pages_count += 1

            pages_data.append({
                "page_number": idx + 1,
                "content": cleaned_text,
                "char_count": char_count
            })
        except Exception as e:
            # Nếu một trang lỗi, ghi nhận trang trống để không gãy toàn bộ file
            pages_data.append({
                "page_number": idx + 1,
                "content": "",
                "char_count": 0,
                "error": str(e)
            })
            empty_pages_count += 1

    doc.close()

    empty_ratio = empty_pages_count / page_count
    if empty_ratio > 0.8:
        raise OCRRequiredException(
            message=f"PDF có {empty_pages_count}/{page_count} trang không có lớp văn bản (tỷ lệ trống {empty_ratio*100:.1f}%). Vui lòng sử dụng file PDF chứa chữ hoặc đã qua xử lý OCR.",
            details={"page_count": page_count, "empty_pages": empty_pages_count, "empty_ratio": empty_ratio}
        )

    total_chars = sum(p["char_count"] for p in pages_data)
    return {
        "filename": filename,
        "page_count": page_count,
        "total_chars": total_chars,
        "pages": pages_data
    }
