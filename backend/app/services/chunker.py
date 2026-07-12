import re
from typing import List, Dict, Any, Optional
from app.schemas.document import ChunkMetadata

def estimate_tokens(text: str) -> int:
    """Ước tính số token theo quy tắc 1 token ~ 4 ký tự tiếng Việt/Anh."""
    if not text:
        return 0
    return max(1, len(text) // 4)

def split_text_with_overlap(text: str, target_tokens: int = 500, overlap_tokens: int = 80) -> List[str]:
    """Cắt một văn bản dài thành các đoạn nhỏ với độ gối đầu (overlap) theo đoạn văn hoặc câu."""
    if estimate_tokens(text) <= target_tokens:
        return [text.strip()]

    target_chars = target_tokens * 4
    overlap_chars = overlap_tokens * 4

    paragraphs = text.split('\n\n')
    chunks = []
    current_chunk = []
    current_length = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        para_len = len(para)

        # Nếu riêng 1 paragraph quá dài hơn target_chars, chia theo câu (.) hoặc dòng (\n)
        if para_len > target_chars:
            if current_chunk:
                chunks.append("\n\n".join(current_chunk).strip())
                # Giữ lại overlap từ phần cuối của current_chunk
                last_part = current_chunk[-1]
                current_chunk = [last_part[-overlap_chars:] if len(last_part) > overlap_chars else last_part]
                current_length = sum(len(p) for p in current_chunk)

            lines_or_sentences = re.split(r'(?<=[.!?])\s+|\n', para)
            for part in lines_or_sentences:
                part = part.strip()
                if not part:
                    continue
                if current_length + len(part) > target_chars and current_chunk:
                    chunks.append("\n".join(current_chunk).strip())
                    last_item = current_chunk[-1]
                    current_chunk = [last_item[-overlap_chars:] if len(last_item) > overlap_chars else last_item]
                    current_length = sum(len(p) for p in current_chunk)
                current_chunk.append(part)
                current_length += len(part)
        else:
            if current_length + para_len > target_chars and current_chunk:
                chunks.append("\n\n".join(current_chunk).strip())
                last_para = current_chunk[-1]
                current_chunk = [last_para[-overlap_chars:] if len(last_para) > overlap_chars else last_para]
                current_length = sum(len(p) for p in current_chunk)
            current_chunk.append(para)
            current_length += para_len + 2

    if current_chunk:
        chunks.append("\n\n".join(current_chunk).strip())

    return [c for c in chunks if c.strip()]

def chunk_exam_document(pages: List[Dict[str, Any]], document_id: str) -> List[Dict[str, Any]]:
    """
    Cắt đoạn theo cấu trúc Đề thi (Câu 1:, Bài 1: ...)
    - Gom câu qua nhiều trang
    - Bảo toàn các phương án A/B/C/D đi cùng câu hỏi
    """
    # Bước 1: Nối toàn bộ text cùng thông tin trang để quét câu hỏi
    # Nhận diện: Câu 1, Câu 1., Câu 1:, Bài 1, Bài 1:, Câu số 1...
    question_pattern = re.compile(r'^(?:Câu|Bài)\s+([0-9]+)\s*[:.\-)?]', re.IGNORECASE | re.MULTILINE)

    all_blocks = []
    for p in pages:
        page_num = p["page_number"]
        content = p["content"]
        if not content.strip():
            continue
        all_blocks.append((page_num, content))

    if not all_blocks:
        return []

    # Ghép văn bản và tìm vị trí bắt đầu của từng câu
    combined_text = ""
    char_to_page = []
    for page_num, content in all_blocks:
        start_idx = len(combined_text)
        combined_text += content + "\n\n"
        char_to_page.extend([page_num] * (len(content) + 2))

    matches = list(question_pattern.finditer(combined_text))

    # Nếu không tìm thấy ít nhất 2 câu hỏi rõ ràng theo regex đề thi, chuyển sang chunk chuyên đề/fallback
    if len(matches) < 2:
        return chunk_textbook_document(pages, document_id)

    chunks_output = []
    chunk_idx = 0

    # Nếu có đoạn mở đầu trước Câu 1 (ví dụ header đề thi, sở GD&ĐT...)
    if matches[0].start() > 50:
        intro_text = combined_text[:matches[0].start()].strip()
        if intro_text:
            intro_page = char_to_page[min(matches[0].start() - 1, len(char_to_page) - 1)]
            chunks_output.append({
                "id": f"{document_id}_chunk_{chunk_idx}",
                "document_id": document_id,
                "content": intro_text,
                "metadata": {
                    "chunk_index": chunk_idx,
                    "page_number": intro_page,
                    "token_count": estimate_tokens(intro_text),
                    "section_title": "Tiêu đề đề thi",
                    "is_exam_question": False,
                    "question_number": None
                }
            })
            chunk_idx += 1

    for idx, match in enumerate(matches):
        q_num = match.group(1)
        start_pos = match.start()
        end_pos = matches[idx + 1].start() if idx + 1 < len(matches) else len(combined_text)

        q_text = combined_text[start_pos:end_pos].strip()
        q_page = char_to_page[min(start_pos, len(char_to_page) - 1)]

        # Nếu câu hỏi quá dài (> 800 tokens), cắt nhỏ có overlap nhưng giữ nguyên question_number trong metadata
        if estimate_tokens(q_text) > 800:
            sub_chunks = split_text_with_overlap(q_text, target_tokens=500, overlap_tokens=80)
            for sub_idx, sub_text in enumerate(sub_chunks):
                chunks_output.append({
                    "id": f"{document_id}_chunk_{chunk_idx}",
                    "document_id": document_id,
                    "content": sub_text,
                    "metadata": {
                        "chunk_index": chunk_idx,
                        "page_number": q_page,
                        "token_count": estimate_tokens(sub_text),
                        "section_title": f"Câu {q_num} (Phần {sub_idx+1})",
                        "is_exam_question": True,
                        "question_number": str(q_num)
                    }
                })
                chunk_idx += 1
        else:
            chunks_output.append({
                "id": f"{document_id}_chunk_{chunk_idx}",
                "document_id": document_id,
                "content": q_text,
                "metadata": {
                    "chunk_index": chunk_idx,
                    "page_number": q_page,
                    "token_count": estimate_tokens(q_text),
                    "section_title": f"Câu {q_num}",
                    "is_exam_question": True,
                    "question_number": str(q_num)
                }
            })
            chunk_idx += 1

    return chunks_output

def chunk_textbook_document(pages: List[Dict[str, Any]], document_id: str) -> List[Dict[str, Any]]:
    """
    Cắt đoạn theo Sách chuyên đề / SGK (Ưu tiên Heading -> Paragraph -> Sentence)
    - Target: 350-700 tokens
    - Overlap: 60-100 tokens
    """
    heading_pattern = re.compile(
        r'^(?:Chương|Bài|Phần|Mục|CHƯƠNG|BÀI|PHẦN)\s+[0-9IVX]+[:.\s]|^[0-9IVX]+\.\s+[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĐ]',
        re.MULTILINE
    )

    chunks_output = []
    chunk_idx = 0

    for p in pages:
        page_num = p["page_number"]
        content = p["content"]
        if not content.strip():
            continue

        # Tìm các heading trong trang
        headings = list(heading_pattern.finditer(content))
        if headings and len(headings) >= 1:
            sections = []
            for h_idx, h_match in enumerate(headings):
                sec_start = h_match.start()
                sec_end = headings[h_idx + 1].start() if h_idx + 1 < len(headings) else len(content)
                sec_text = content[sec_start:sec_end].strip()
                if sec_text:
                    sections.append(sec_text)
            
            # Nếu có phần text trước heading đầu tiên của trang
            if headings[0].start() > 30:
                pre_text = content[:headings[0].start()].strip()
                if pre_text:
                    sections.insert(0, pre_text)

            for sec_text in sections:
                # Tìm tiêu đề ngắn cho metadata
                first_line = sec_text.split('\n')[0][:60].strip()
                sub_parts = split_text_with_overlap(sec_text, target_tokens=500, overlap_tokens=80)
                for part in sub_parts:
                    chunks_output.append({
                        "id": f"{document_id}_chunk_{chunk_idx}",
                        "document_id": document_id,
                        "content": part,
                        "metadata": {
                            "chunk_index": chunk_idx,
                            "page_number": page_num,
                            "token_count": estimate_tokens(part),
                            "section_title": first_line,
                            "is_exam_question": False,
                            "question_number": None
                        }
                    })
                    chunk_idx += 1
        else:
            # Fallback cắt theo độ dài chuẩn cho trang không có heading rõ ràng
            sub_parts = split_text_with_overlap(content, target_tokens=500, overlap_tokens=80)
            for part in sub_parts:
                chunks_output.append({
                    "id": f"{document_id}_chunk_{chunk_idx}",
                    "document_id": document_id,
                    "content": part,
                    "metadata": {
                        "chunk_index": chunk_idx,
                        "page_number": page_num,
                        "token_count": estimate_tokens(part),
                        "section_title": f"Trang {page_num}",
                        "is_exam_question": False,
                        "question_number": None
                    }
                })
                chunk_idx += 1

    return chunks_output

def process_document_chunks(pages: List[Dict[str, Any]], document_id: str, doc_type: str = "exam") -> List[Dict[str, Any]]:
    """Hàm tổng hợp quyết định chiến lược cắt đoạn dựa trên doc_type và cấu trúc văn bản."""
    if doc_type == "exam":
        return chunk_exam_document(pages, document_id)
    else:
        return chunk_textbook_document(pages, document_id)
