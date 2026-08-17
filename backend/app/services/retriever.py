from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any
from uuid import UUID

from app.core.config import Settings
from app.db.json_compat import as_json_dict
from app.db.repositories.chunk_repo import ChunkRepository

if TYPE_CHECKING:
    from app.services.embedding import EmbeddingService


@dataclass(frozen=True)
class RetrievedChunk:
    id: str
    document_id: UUID
    content: str
    metadata: dict[str, Any]
    document_name: str
    title: str
    score: float


class HybridRetriever:
    def __init__(self, chunk_repo: ChunkRepository, embedding: Any, settings: Settings) -> None:
        self.chunk_repo = chunk_repo
        self.embedding = embedding
        self.limit = settings.max_retrieval_results
        self.rrf_k = settings.rrf_k

    async def search(
        self,
        owner_id: UUID,
        query: str,
        *,
        document_id: UUID | None = None,
    ) -> list[RetrievedChunk]:
        query_embedding = (await self.embedding.encode([query]))[0]
        vector_results, lexical_results = await asyncio.gather(
            self.chunk_repo.vector_search(
                owner_id, query_embedding, limit=self.limit * 2, document_id=document_id
            ),
            self.chunk_repo.lexical_search(
                owner_id, query, limit=self.limit * 2, document_id=document_id
            ),
        )

        combined: dict[str, dict[str, Any]] = {}
        for rank, row in enumerate(vector_results, start=1):
            item = combined.setdefault(str(row["id"]), {"row": row, "rrf": 0.0})
            item["rrf"] += 1 / (self.rrf_k + rank)
        for rank, row in enumerate(lexical_results, start=1):
            item = combined.setdefault(str(row["id"]), {"row": row, "rrf": 0.0})
            item["rrf"] += 1 / (self.rrf_k + rank)

        ranked = sorted(combined.values(), key=lambda item: item["rrf"], reverse=True)[: self.limit]
        max_rrf = ranked[0]["rrf"] if ranked else 1.0
        return [
            RetrievedChunk(
                id=str(item["row"]["id"]),
                document_id=item["row"]["document_id"],
                content=str(item["row"]["content"]),
                metadata=as_json_dict(item["row"].get("metadata")),
                document_name=str(item["row"].get("filename") or item["row"].get("title") or "Tài liệu"),
                title=str(item["row"].get("title") or "Tài liệu"),
                score=min(1.0, float(item["rrf"]) / max_rrf),
            )
            for item in ranked
        ]
