import json
from collections.abc import AsyncIterator

import asyncpg

from app.core.config import Settings


async def _init_connection(connection: asyncpg.Connection) -> None:
    # asyncpg does not decode json/jsonb automatically unless a codec is registered.
    # Repositories rely on Python dict/list values for metadata and citations.
    await connection.set_type_codec(
        "json",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )
    await connection.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )


async def create_pool(settings: Settings) -> asyncpg.Pool:
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    return await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=1,
        max_size=10,
        command_timeout=60,
        init=_init_connection,
        server_settings={"search_path": "public,extensions"},
    )


async def close_pool(pool: asyncpg.Pool | None) -> None:
    if pool is not None:
        await pool.close()


async def pool_connection(pool: asyncpg.Pool) -> AsyncIterator[asyncpg.Connection]:
    async with pool.acquire() as connection:
        yield connection


async def check_database(pool: asyncpg.Pool | None) -> bool:
    if pool is None:
        return False
    try:
        async with pool.acquire() as connection:
            await connection.execute("SELECT 1")
        return True
    except (OSError, asyncpg.PostgresError):
        return False
