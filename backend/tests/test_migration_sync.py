"""Task 7.2 — bản canonical và bản deploy của migration phải giống hệt.

Bản canonical nằm ở `supabase/migrations/`, bản deploy ở `backend/app/db/migrations/`.
Test này tồn tại để lần sửa sau không âm thầm chỉ chỉnh một bản.
"""

from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
CANONICAL_DIR = REPO_ROOT / "supabase" / "migrations"
DEPLOY_DIR = REPO_ROOT / "backend" / "app" / "db" / "migrations"

# 001_init.sql cố tình không so sánh: hai bản đã khác định dạng từ trước thay đổi này.
SYNCED_FILES = ["002_add_stored_document_status.sql"]


@pytest.mark.parametrize("filename", SYNCED_FILES)
def test_migration_copies_are_identical(filename):
    canonical = CANONICAL_DIR / filename
    deploy = DEPLOY_DIR / filename
    assert canonical.is_file(), f"Thiếu migration canonical: {canonical}"
    assert deploy.is_file(), f"Thiếu bản đồng bộ dưới backend: {deploy}"
    assert canonical.read_text(encoding="utf-8") == deploy.read_text(encoding="utf-8"), (
        f"{filename} khác nhau giữa supabase/migrations/ và backend/app/db/migrations/"
    )


def test_stored_status_is_added_to_check_constraint():
    sql = (CANONICAL_DIR / SYNCED_FILES[0]).read_text(encoding="utf-8")
    for value in ("processing", "stored", "ready", "failed", "ocr_required"):
        assert f"'{value}'" in sql
    # Phải chạy trong transaction để migration thất bại thì rollback toàn bộ.
    assert "BEGIN;" in sql and "COMMIT;" in sql
    # Không được chạm các bảng phải bảo toàn.
    for table in ("document_chunks", "conversations", "messages"):
        assert f"DROP TABLE public.{table}" not in sql
