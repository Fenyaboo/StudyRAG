import hashlib
import re
from dataclasses import dataclass
from typing import Any
from uuid import UUID


@dataclass(frozen=True)
class Chunk:
    id: str
    content: str
    metadata: dict[str, Any]


@dataclass(frozen=True)
class _Segment:
    """Một đoạn văn bản đã chốt cùng số token đã tính sẵn cho đoạn đó."""

    text: str
    token_count: int


class SmartChunker:
    """Page-aware chunker with model-token limits and lightweight overlap.

    Chi phí tokenizer là tuyến tính theo độ dài văn bản: mỗi đoạn văn chỉ được
    tokenize MỘT lần (batch theo từng từ), sau đó việc cắt cửa sổ chỉ cộng dồn
    số token đã biết. Số token này được tái sử dụng luôn cho metadata.
    """

    def __init__(self, *, max_tokens: int = 220, overlap_tokens: int = 32) -> None:
        self.max_tokens = max_tokens
        self.overlap_tokens = overlap_tokens
        self._tokenizer = None

    def _get_tokenizer(self):
        if self._tokenizer is None:
            try:
                from transformers import AutoTokenizer

                from app.core.config import get_settings, model_cache_dir

                self._tokenizer = AutoTokenizer.from_pretrained(
                    get_settings().embedding_model,
                    cache_dir=model_cache_dir(),
                )
            except Exception:
                self._tokenizer = False
        return self._tokenizer

    def token_count(self, text: str) -> int:
        tokenizer = self._get_tokenizer()
        if tokenizer:
            try:
                return len(tokenizer.encode(text, add_special_tokens=False))
            except Exception:
                pass
        return max(1, len(re.findall(r"\S+", text)))

    def _word_token_counts(self, words: list[str]) -> list[int]:
        """Số token của từng từ, tính bằng MỘT lần gọi tokenizer cho cả danh sách.

        Fallback về 1 token/từ (đếm theo whitespace) khi không load được tokenizer.
        """
        if not words:
            return []
        tokenizer = self._get_tokenizer()
        if tokenizer:
            try:
                encoded = tokenizer(words, add_special_tokens=False)["input_ids"]
                counts = [max(1, len(ids)) for ids in encoded]
                if len(counts) == len(words):
                    return counts
            except Exception:
                pass
        return [1] * len(words)

    def _pack_words(self, words: list[str], counts: list[int]) -> list[_Segment]:
        """Cắt danh sách từ thành các segment <= max_tokens, có overlap giữa hai segment liền kề."""
        segments: list[_Segment] = []
        current: list[str] = []
        current_counts: list[int] = []
        total = 0
        for word, count in zip(words, counts, strict=True):
            if current and total + count > self.max_tokens:
                segments.append(_Segment(text=" ".join(current), token_count=total))
                overlap: list[str] = []
                overlap_counts: list[int] = []
                overlap_total = 0
                for previous, previous_count in zip(reversed(current), reversed(current_counts), strict=True):
                    overlap.insert(0, previous)
                    overlap_counts.insert(0, previous_count)
                    overlap_total += previous_count
                    if overlap_total >= self.overlap_tokens:
                        break
                # Không giữ overlap nếu nó khiến segment mới vượt giới hạn ngay lập tức.
                if overlap_total + count > self.max_tokens:
                    overlap, overlap_counts, overlap_total = [], [], 0
                current, current_counts, total = overlap, overlap_counts, overlap_total
            current.append(word)
            current_counts.append(count)
            total += count
        if current:
            segments.append(_Segment(text=" ".join(current), token_count=total))
        return segments

    def _page_segments(self, text: str) -> list[_Segment]:
        paragraphs = [part.strip() for part in re.split(r"\n\s*\n+", text) if part.strip()]
        if not paragraphs:
            paragraphs = [line.strip() for line in text.splitlines() if line.strip()]
        segments: list[_Segment] = []
        for paragraph in paragraphs:
            words = paragraph.split()
            counts = self._word_token_counts(words)
            total = sum(counts)
            if total <= self.max_tokens:
                segments.append(_Segment(text=paragraph, token_count=max(1, total)))
            else:
                segments.extend(self._pack_words(words, counts))
        return segments

    def build(self, document_id: UUID, pages: list[Any], *, doc_type: str) -> list[Chunk]:
        chunks: list[Chunk] = []
        for page in pages:
            page_number = int(page.page_number)
            for local_index, segment in enumerate(self._page_segments(page.text)):
                normalized = re.sub(r"\s+", " ", segment.text).strip()
                if not normalized:
                    continue
                digest = hashlib.sha1(
                    f"{document_id}:{page_number}:{local_index}:{normalized}".encode("utf-8")
                ).hexdigest()
                chunks.append(
                    Chunk(
                        id=digest,
                        content=normalized,
                        metadata={
                            "page": page_number,
                            "page_start": page_number,
                            "page_end": page_number,
                            "chunk_index": len(chunks),
                            "document_type": doc_type,
                            # Tái sử dụng số token đã tính khi cắt segment, không tokenize lại.
                            "token_count": segment.token_count,
                        },
                    )
                )
        return chunks
