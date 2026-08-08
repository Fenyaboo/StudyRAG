import json
from typing import Any
from uuid import UUID

import asyncpg


def vector_literal(values: list[float]) -> str:
    return "[" + ",".join(format(float(value), ".8f") for value in values) + "]"


class ChunkRepository:
    """Chunk persistence and owner-scoped lexical/vector search."""

    def __init__(self, pool: asyncpg.Pool) -> None:
        self.pool = pool

    async def replace_for_document(
        self,
        owner_id: UUID,
        document_id: UUID,
        chunks: list[dict[str, Any]],
    ) -> None:
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                owns_document = await conn.fetchval(
                    "SELECT 1 FROM public.documents WHERE id=$1 AND owner_id=$2",
                    document_id,
                    owner_id,
                )
                if not owns_document:
                    raise ValueError("Document does not belong to owner")
                await conn.execute("DELETE FROM public.document_chunks WHERE document_id=$1", document_id)
                await conn.executemany(
                    """
                    INSERT INTO public.document_chunks (id,document_id,content,embedding,metadata)
                    VALUES ($1,$2,$3,$4::extensions.vector,$5::jsonb)
                    """,
                    [
                        (
                            item["id"],
                            document_id,
                            item["content"],
                            vector_literal(item["embedding"]),
                            json.dumps(item.get("metadata", {}), ensure_ascii=False),
                        )
                        for item in chunks
                    ],
                )

    async def vector_search(
        self,
        owner_id: UUID,
        embedding: list[float],
        *,
        limit: int,
        document_id: UUID | None = None,
    ) -> list[dict[str, Any]]:
        params: list[Any] = [vector_literal(embedding), owner_id]
        conditions = ["d.owner_id=$2", "c.embedding IS NOT NULL"]
        if document_id:
            params.append(document_id)
            conditions.append(f"c.document_id=${len(params)}")
        limit_position = len(params) + 1
        query = f"""
            SELECT c.id,c.document_id,c.content,c.metadata,d.title,d.filename,
                   GREATEST(0, 1 - (c.embedding <=> $1::extensions.vector)) AS score
            FROM public.document_chunks c
            JOIN public.documents d ON d.id=c.document_id
            WHERE {' AND '.join(conditions)}
            ORDER BY c.embedding <=> $1::extensions.vector
            LIMIT ${limit_position}
        """
        params.append(limit)
        async with self.pool.acquire() as conn:
            records = await conn.fetch(query, *params)
        return [dict(record) for record in records]

    async def lexical_search(
        self,
        owner_id: UUID,
        query_text: str,
        *,
        limit: int,
        document_id: UUID | None = None,
    ) -> list[dict[str, Any]]:
        params: list[Any] = [query_text, owner_id]
        conditions = ["d.owner_id=$2", "c.content_tsv @@ plainto_tsquery('simple'::regconfig, public.immutable_unaccent($1))"]
        if document_id:
            params.append(document_id)
            conditions.append(f"c.document_id=${len(params)}")
        limit_position = len(params) + 1
        query = f"""
            SELECT c.id,c.document_id,c.content,c.metadata,d.title,d.filename,
                   ts_rank_cd(c.content_tsv, plainto_tsquery('simple'::regconfig, public.immutable_unaccent($1))) AS score
            FROM public.document_chunks c
            JOIN public.documents d ON d.id=c.document_id
            WHERE {' AND '.join(conditions)}
            ORDER BY score DESC
            LIMIT ${limit_position}
        """
        params.append(limit)
        async with self.pool.acquire() as conn:
            records = await conn.fetch(query, *params)
        return [dict(record) for record in records]
