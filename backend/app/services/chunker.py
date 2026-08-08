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


class SmartChunker:
    """Page-aware chunker with model-token limits and lightweight overlap."""

    def __init__(self, *, max_tokens: int = 220, overlap_tokens: int = 32) -> None:
        self.max_tokens = max_tokens
        self.overlap_tokens = overlap_tokens
        self._tokenizer = None

    def _get_tokenizer(self):
        if self._tokenizer is None:
            try:
                from transformers import AutoTokenizer

                from app.core.config import get_settings

                self._tokenizer = AutoTokenizer.from_pretrained(get_settings().embedding_model)
            except Exception:
                self._tokenizer = False
        return self._tokenizer

    def token_count(self, text: str) -> int:
        tokenizer = self._get_tokenizer()
        if tokenizer:
            return len(tokenizer.encode(text, add_special_tokens=False))
        return max(1, len(re.findall(r"\S+", text)))

    def _split_long_text(self, text: str) -> list[str]:
        words = text.split()
        segments: list[str] = []
        current: list[str] = []
        for word in words:
            candidate = " ".join([*current, word])
            if current and self.token_count(candidate) > self.max_tokens:
                segments.append(" ".join(current))
                overlap: list[str] = []
                for previous in reversed(current):
                    overlap.insert(0, previous)
                    if self.token_count(" ".join(overlap)) >= self.overlap_tokens:
                        break
                current = [*overlap, word]
            else:
                current.append(word)
        if current:
            segments.append(" ".join(current))
        return segments

    def _page_segments(self, text: str) -> list[str]:
        paragraphs = [part.strip() for part in re.split(r"\n\s*\n+", text) if part.strip()]
        if not paragraphs:
            paragraphs = [line.strip() for line in text.splitlines() if line.strip()]
        segments: list[str] = []
        for paragraph in paragraphs:
            if self.token_count(paragraph) <= self.max_tokens:
                segments.append(paragraph)
            else:
                segments.extend(self._split_long_text(paragraph))
        return segments

    def build(self, document_id: UUID, pages: list[Any], *, doc_type: str) -> list[Chunk]:
        chunks: list[Chunk] = []
        for page in pages:
            page_number = int(page.page_number)
            for local_index, segment in enumerate(self._page_segments(page.text)):
                normalized = re.sub(r"\s+", " ", segment).strip()
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
                            "token_count": self.token_count(normalized),
                        },
                    )
                )
        return chunks
