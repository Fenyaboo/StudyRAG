from pathlib import Path
import re

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core.config import settings
from app.db.supabase import StorageRepository


def test_private_migration_has_owner_guard_bucket_and_rls():
    sql = Path('../supabase/migrations/20260713_auth_private_library.sql').read_text()
    assert "raise exception 'Legacy documents must be assigned or removed manually'" in sql
    assert 'owner_id uuid not null references auth.users(id)' in sql.lower()
    assert "'study-documents'" in sql
    assert 'enable row level security' in sql.lower()
    assert 'documents_owner_file_hash_key' in sql


def test_private_migration_enforces_bucket_privacy_and_document_owned_storage_paths():
    sql = Path('../supabase/migrations/20260713_auth_private_library.sql').read_text().lower()

    assert 'on conflict (id) do update set public = false' in sql
    storage_policy = sql[sql.index('create policy "owner study documents"'):]
    using_clause = re.search(r'using\s*\((.*?)\)\s*with check', storage_policy, re.DOTALL)
    with_check_clause = re.search(r'with check\s*\((.*?)\)\s*;', storage_policy, re.DOTALL)

    assert using_clause is not None
    assert with_check_clause is not None
    for clause in (using_clause.group(1), with_check_clause.group(1)):
        assert '(storage.foldername(name))[1] = (select auth.uid()::text)' in clause
        assert 'array_length(storage.foldername(name), 1) >= 2' in clause
        assert 'documents.owner_id = auth.uid()' in clause
        assert 'documents.id::text = (storage.foldername(name))[2]' in clause


def test_private_migration_bootstraps_clean_schema_and_refuses_legacy_schema():
    sql = Path('../supabase/migrations/20260713_auth_private_library.sql').read_text().lower()

    assert "to_regclass('public.documents')" in sql
    assert 'create table public.documents' in sql
    assert 'create table public.document_chunks' in sql
    assert 'add column owner_id' not in sql
    assert 'documents_owner_created_at_idx' in sql
    assert 'document_chunks_document_id_idx' in sql
    assert 'documents_owner_file_hash_key' in sql


def test_postgres_repository_never_creates_legacy_schema_or_falls_back_to_jsonl(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'DATABASE_URL', 'postgresql://example.invalid/studyrag')
    monkeypatch.setattr(settings, 'VECTOR_STORE_TYPE', 'supabase_pgvector')
    monkeypatch.setattr(settings, 'UPLOAD_DIR', str(tmp_path / 'raw'))
    monkeypatch.setattr(settings, 'PROCESSED_DIR', str(tmp_path / 'processed'))
    repository = StorageRepository()

    executed_sql: list[str] = []

    class Cursor:
        def execute(self, statement):
            executed_sql.append(statement)

        def fetchone(self):
            return {
                'documents_table': True,
                'document_chunks_table': True,
                'owner_id_column': True,
                'storage_path_column': True,
                'documents_rls': True,
                'document_chunks_rls': True,
                'owner_documents_policy': True,
                'owner_document_chunks_policy': True,
                'owner_file_hash_index': True,
                'owner_created_at_index': True,
                'chunk_document_id_index': True,
                'private_bucket': True,
                'owner_study_documents_policy': True,
            }

        def close(self):
            pass

    class Connection:
        def cursor(self):
            return Cursor()

        def close(self):
            pass

    monkeypatch.setattr(repository, '_get_pg_connection', lambda: Connection())
    repository.init_db()

    assert repository.is_ready
    assert not any('create table' in statement.lower() for statement in executed_sql)

    processed_dir = tmp_path / 'processed'
    assert not processed_dir.exists()
    processed_dir.mkdir()
    (processed_dir / 'documents_registry.json').write_text(
        '[{"id": "local-document", "owner_id": "user-a"}]', encoding='utf-8'
    )

    def unavailable_connection():
        raise RuntimeError('database unavailable')

    monkeypatch.setattr(repository, '_get_pg_connection', unavailable_connection)
    operations = (
        lambda: repository.get_document_by_hash('user-a', 'local-hash'),
        lambda: repository.list_documents('user-a'),
        lambda: repository.search('algebra', owner_id='user-a'),
    )
    for operation in operations:
        repository._postgres_ready = True
        repository._postgres_error = None
        with pytest.raises(RuntimeError, match='Supabase/PostgreSQL database operation failed'):
            operation()


@pytest.mark.parametrize('query_text', ['', 'và'])
def test_postgres_search_requires_readiness_even_without_effective_terms(query_text, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'DATABASE_URL', 'postgresql://example.invalid/studyrag')
    monkeypatch.setattr(settings, 'VECTOR_STORE_TYPE', 'supabase_pgvector')
    monkeypatch.setattr(settings, 'UPLOAD_DIR', str(tmp_path / 'raw'))
    monkeypatch.setattr(settings, 'PROCESSED_DIR', str(tmp_path / 'processed'))
    repository = StorageRepository()
    repository._postgres_ready = False
    repository._postgres_error = 'Supabase/PostgreSQL is not ready for retrieval.'

    with pytest.raises(RuntimeError, match='not ready for retrieval'):
        repository.search(query_text, owner_id='user-a')


def test_settings_expose_only_server_auth_values():
    settings = Settings(
        SUPABASE_SERVICE_ROLE_KEY='server-only',
        SUPABASE_JWT_ISSUER='https://id.supabase.co/auth/v1',
    )
    assert settings.SUPABASE_SERVICE_ROLE_KEY == 'server-only'
    assert settings.SUPABASE_JWT_AUDIENCE == 'authenticated'


def test_cors_origins_accept_csv_and_json_arrays():
    assert Settings(FRONTEND_ORIGINS='http://localhost:5173,https://study.example.com').FRONTEND_ORIGINS == [
        'http://localhost:5173',
        'https://study.example.com',
    ]
    assert Settings(FRONTEND_ORIGINS='["https://study.example.com", "https://preview.example.com"]').FRONTEND_ORIGINS == [
        'https://study.example.com',
        'https://preview.example.com',
    ]


@pytest.mark.parametrize(
    'origins',
    [
        '["https://study.example.com"',
        '*',
        'https://*.example.com',
        'https://example.*',
        'https://study.example.com/path',
        'https://study.example.com:bad',
        'https://example.com:',
        'http://localhost:',
    ],
)
def test_cors_origins_reject_malformed_or_untrusted_values(origins):
    with pytest.raises(ValidationError):
        Settings(FRONTEND_ORIGINS=origins)
