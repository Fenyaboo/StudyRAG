from typing import Any
from uuid import UUID

import asyncpg


class DocumentRepository:
    """Document queries. Every method requires owner_id for tenant isolation."""

    def __init__(self, pool: asyncpg.Pool) -> None:
        self.pool = pool

    async def create(
        self,
        owner_id: UUID,
        *,
        document_id: UUID,
        storage_key: str,
        title: str,
        filename: str,
        file_hash: str,
        file_size_bytes: int,
        subject: str,
        doc_type: str,
    ) -> dict[str, Any]:
        """Chèn document mới với id được caller quyết định tường minh.

        `document_id` là bắt buộc: caller đã dùng chính id này để tạo `storage_key`
        và để lên lịch task xử lý nền, nên row trong DB phải mang đúng id đó thay vì
        để Postgres sinh ra id khác qua DEFAULT gen_random_uuid().
        """
        query = """
            INSERT INTO public.documents
                (id, owner_id, storage_key, title, filename, file_hash, file_size_bytes, subject, doc_type)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING id,title,filename,file_size_bytes,subject,doc_type,status,page_count,
                      chunk_count,error_message,created_at,updated_at,storage_key
        """
        async with self.pool.acquire() as conn:
            record = await conn.fetchrow(
                query,
                document_id,
                owner_id,
                storage_key,
                title,
                filename,
                file_hash,
                file_size_bytes,
                subject,
                doc_type,
            )
        return dict(record)

    async def find_by_hash(self, owner_id: UUID, file_hash: str) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            record = await conn.fetchrow(
                "SELECT * FROM public.documents WHERE owner_id=$1 AND file_hash=$2",
                owner_id,
                file_hash,
            )
        return dict(record) if record else None

    async def get(self, owner_id: UUID, document_id: UUID) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            record = await conn.fetchrow(
                "SELECT * FROM public.documents WHERE owner_id=$1 AND id=$2",
                owner_id,
                document_id,
            )
        return dict(record) if record else None

    async def list(
        self,
        owner_id: UUID,
        *,
        subject: str | None = None,
        status: str | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        conditions = ["owner_id=$1"]
        params: list[Any] = [owner_id]
        index = 2
        if subject:
            conditions.append(f"subject=${index}")
            params.append(subject)
            index += 1
        if status:
            conditions.append(f"status=${index}")
            params.append(status)
            index += 1
        if search:
            conditions.append(f"(title ILIKE '%' || ${index} || '%' OR filename ILIKE '%' || ${index} || '%')")
            params.append(search)
            index += 1

        where = " AND ".join(conditions)
        data_query = f"""
            SELECT id,title,filename,file_size_bytes,subject,doc_type,status,page_count,
                   chunk_count,error_message,created_at,updated_at
            FROM public.documents
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT ${index} OFFSET ${index + 1}
        """
        count_query = f"SELECT count(*) FROM public.documents WHERE {where}"
        params_with_page = [*params, limit, offset]
        async with self.pool.acquire() as conn:
            records = await conn.fetch(data_query, *params_with_page)
            total = await conn.fetchval(count_query, *params)
        return [dict(record) for record in records], int(total or 0)

    async def update_status(
        self,
        owner_id: UUID,
        document_id: UUID,
        *,
        status: str,
        page_count: int | None = None,
        chunk_count: int | None = None,
        error_message: str | None = None,
    ) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            record = await conn.fetchrow(
                """
                UPDATE public.documents
                SET status=$3,
                    page_count=COALESCE($4, page_count),
                    chunk_count=COALESCE($5, chunk_count),
                    error_message=$6,
                    updated_at=now()
                WHERE owner_id=$1 AND id=$2
                RETURNING *
                """,
                owner_id,
                document_id,
                status,
                page_count,
                chunk_count,
                error_message,
            )
        return dict(record) if record else None

    async def fail_stale_processing(self, *, older_than_seconds: int) -> int:
        """Maintenance job chạy lúc startup — KHÔNG phải endpoint phục vụ người dùng.

        Chuyển các document còn treo ở `processing` mà `updated_at` cũ hơn
        `older_than_seconds` sang `failed` (ví dụ tiến trình bị restart giữa lúc xử lý).
        Đây là tác vụ bảo trì toàn hệ thống nên cố tình không nhận `owner_id`; bù lại
        method chỉ được phép đổi trạng thái theo mốc thời gian và KHÔNG trả về bất kỳ
        dữ liệu nào của owner — chỉ trả về số row đã cập nhật.
        """
        async with self.pool.acquire() as conn:
            count = await conn.fetchval(
                """
                WITH stale AS (
                    UPDATE public.documents
                    SET status='failed',
                        error_message=$2,
                        updated_at=now()
                    WHERE status='processing'
                      AND updated_at < now() - make_interval(secs => $1::double precision)
                    RETURNING 1
                )
                SELECT count(*) FROM stale
                """,
                float(older_than_seconds),
                "Quá trình xử lý bị gián đoạn (tiến trình khởi động lại hoặc vượt thời gian cho phép).",
            )
        return int(count or 0)

    async def stats(self, owner_id: UUID) -> dict[str, int]:
        async with self.pool.acquire() as conn:
            records = await conn.fetch(
                "SELECT status, count(*) AS count FROM public.documents WHERE owner_id=$1 GROUP BY status",
                owner_id,
            )
        result = {
            "total": 0,
            "ready": 0,
            "stored": 0,
            "processing": 0,
            "failed": 0,
            "ocr_required": 0,
        }
        for record in records:
            key = str(record["status"])
            count = int(record["count"])
            # `result.get(key, 0) + count` thay cho `result[key] = count`: một status lạ
            # từ DB (ví dụ migration mới đã chạy ở môi trường khác) không được phép gây
            # KeyError, vì endpoint stats hỏng sẽ kéo theo cả danh sách tài liệu ở frontend.
            result[key] = result.get(key, 0) + count
            result["total"] += count
        return result

    async def delete(self, owner_id: UUID, document_id: UUID) -> str | None:
        async with self.pool.acquire() as conn:
            storage_key = await conn.fetchval(
                "DELETE FROM public.documents WHERE owner_id=$1 AND id=$2 RETURNING storage_key",
                owner_id,
                document_id,
            )
        return str(storage_key) if storage_key else None
