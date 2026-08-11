-- 002_add_stored_document_status.sql
-- Thêm giá trị `stored` vào documents.status: tài liệu đã lưu trữ nhưng chưa lập chỉ mục
-- (chunk_count = 0), dùng khi AI_FEATURES_ENABLED=false.
--
-- Không drop bảng, không đổi cột, không xóa index, không chạm document_chunks,
-- conversations, messages, extension vector/unaccent hay policy RLS.
BEGIN;

-- Ràng buộc CHECK ở 001_init.sql được khai báo inline nên PostgreSQL tự sinh tên
-- (`documents_status_check`). Tra cứu theo định nghĩa thay vì tin vào tên để migration
-- không âm thầm thêm constraint mới bên cạnh constraint cũ chặt hơn.
DO $$
DECLARE
    target_name text;
BEGIN
    SELECT con.conname INTO target_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'documents'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%ocr_required%'
    LIMIT 1;

    IF target_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.documents DROP CONSTRAINT %I', target_name);
    END IF;
END $$;

-- Tập giá trị mới là siêu tập của tập cũ, nên mọi row hiện có đều pass và số row không đổi.
ALTER TABLE public.documents
    ADD CONSTRAINT documents_status_check
    CHECK (status IN ('processing', 'stored', 'ready', 'failed', 'ocr_required'));

COMMIT;
