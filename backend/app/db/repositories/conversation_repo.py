from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.db.json_compat import as_json_list


class ConversationRepository:
    """Conversation/message queries. Every public method is owner-scoped."""

    def __init__(self, pool: asyncpg.Pool) -> None:
        self.pool = pool

    async def create(self, owner_id: UUID, *, document_id: UUID | None = None, title: str = "Hội thoại mới") -> dict[str, Any]:
        async with self.pool.acquire() as conn:
            record = await conn.fetchrow(
                """
                INSERT INTO public.conversations (owner_id,document_id,title)
                VALUES ($1,$2,$3)
                RETURNING id,title,document_id,created_at,updated_at,last_message_at,dify_conversation_id
                """,
                owner_id,
                document_id,
                title,
            )
        return dict(record)

    async def get(self, owner_id: UUID, conversation_id: UUID) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            record = await conn.fetchrow(
                "SELECT * FROM public.conversations WHERE owner_id=$1 AND id=$2",
                owner_id,
                conversation_id,
            )
        return dict(record) if record else None

    async def list(self, owner_id: UUID, *, limit: int = 50, offset: int = 0) -> tuple[list[dict[str, Any]], int]:
        async with self.pool.acquire() as conn:
            records = await conn.fetch(
                """
                SELECT id,title,document_id,created_at,updated_at,last_message_at
                FROM public.conversations
                WHERE owner_id=$1
                ORDER BY last_message_at DESC
                LIMIT $2 OFFSET $3
                """,
                owner_id,
                limit,
                offset,
            )
            total = await conn.fetchval(
                "SELECT count(*) FROM public.conversations WHERE owner_id=$1", owner_id
            )
        return [dict(record) for record in records], int(total or 0)

    async def rename(self, owner_id: UUID, conversation_id: UUID, title: str) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            record = await conn.fetchrow(
                """
                UPDATE public.conversations SET title=$3, updated_at=now()
                WHERE owner_id=$1 AND id=$2
                RETURNING id,title,document_id,created_at,updated_at,last_message_at
                """,
                owner_id,
                conversation_id,
                title,
            )
        return dict(record) if record else None

    async def delete(self, owner_id: UUID, conversation_id: UUID) -> bool:
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM public.conversations WHERE owner_id=$1 AND id=$2",
                owner_id,
                conversation_id,
            )
        return result.endswith(" 1")

    async def set_dify_conversation_id(
        self,
        owner_id: UUID,
        conversation_id: UUID,
        dify_conversation_id: str,
    ) -> None:
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE public.conversations
                SET dify_conversation_id=$3, updated_at=now()
                WHERE owner_id=$1 AND id=$2
                """,
                owner_id,
                conversation_id,
                dify_conversation_id,
            )

    async def add_message(
        self,
        owner_id: UUID,
        conversation_id: UUID,
        *,
        role: str,
        content: str,
        citations: list[dict[str, Any]] | None = None,
        latency_ms: int | None = None,
        dify_message_id: str | None = None,
    ) -> dict[str, Any]:
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                record = await conn.fetchrow(
                    """
                    INSERT INTO public.messages
                        (conversation_id,role,content,citations,latency_ms,dify_message_id)
                    SELECT $2,$3,$4,$5::jsonb,$6,$7
                    WHERE EXISTS (
                        SELECT 1 FROM public.conversations
                        WHERE id=$2 AND owner_id=$1
                    )
                    RETURNING id,conversation_id,role,content,citations,latency_ms,created_at
                    """,
                    owner_id,
                    conversation_id,
                    role,
                    content,
                    # Codec jsonb đã tự encode; json.dumps ở đây sẽ gây double-encode.
                    citations or [],
                    latency_ms,
                    dify_message_id,
                )
                if record is None:
                    raise ValueError("Conversation does not belong to owner")
                await conn.execute(
                    "UPDATE public.conversations SET last_message_at=now(), updated_at=now() WHERE id=$1 AND owner_id=$2",
                    conversation_id,
                    owner_id,
                )
        message = dict(record)
        message["citations"] = as_json_list(message.get("citations"))
        return message

    async def list_messages(self, owner_id: UUID, conversation_id: UUID) -> list[dict[str, Any]]:
        async with self.pool.acquire() as conn:
            records = await conn.fetch(
                """
                SELECT m.id,m.conversation_id,m.role,m.content,m.citations,m.latency_ms,m.created_at
                FROM public.messages m
                JOIN public.conversations c ON c.id=m.conversation_id
                WHERE m.conversation_id=$2 AND c.owner_id=$1
                ORDER BY m.created_at ASC
                """,
                owner_id,
                conversation_id,
            )
        messages: list[dict[str, Any]] = []
        for record in records:
            message = dict(record)
            message["citations"] = as_json_list(message.get("citations"))
            messages.append(message)
        return messages
