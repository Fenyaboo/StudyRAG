import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.core.config import settings

class StorageRepository:
    """
    Hybrid Storage Engine cho Milestone 1:
    - Nếu sử dụng Supabase (VECTOR_STORE_TYPE == 'supabase_pgvector' hoặc DATABASE_URL có postgresql):
      Lưu trữ trên cloud PostgreSQL với pgvector.
    - Nếu sử dụng Local (sqlite_chroma):
      Lưu trữ metadata tài liệu trên SQLite/JSONL và chuẩn bị sẵn sàng cho ChromaDB ở Milestone 2.
    """
    def __init__(self):
        self.storage_type = settings.VECTOR_STORE_TYPE
        self.is_postgres = "postgres" in settings.DATABASE_URL.lower() or self.storage_type == "supabase_pgvector"
        
        # Đảm bảo thư mục lưu trữ local tồn tại
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        os.makedirs(settings.PROCESSED_DIR, exist_ok=True)
        self.local_registry_file = os.path.join(settings.PROCESSED_DIR, "documents_registry.json")
        if not os.path.exists(self.local_registry_file):
            with open(self.local_registry_file, "w", encoding="utf-8") as f:
                json.dump([], f)

    def _get_pg_connection(self):
        """Khởi tạo kết nối psycopg2 tới Supabase/PostgreSQL nếu khả dụng."""
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            dsn = settings.DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://")
            conn = psycopg2.connect(dsn, cursor_factory=RealDictCursor)
            return conn
        except Exception as e:
            raise RuntimeError(f"Lỗi kết nối Supabase/PostgreSQL: {str(e)}")

    def init_db(self):
        """Kiểm tra và khởi tạo bảng trên Supabase hoặc Local."""
        if self.is_postgres:
            try:
                conn = self._get_pg_connection()
                cur = conn.cursor()
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS documents (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        filename TEXT NOT NULL,
                        file_hash TEXT UNIQUE NOT NULL,
                        file_size_bytes INT NOT NULL,
                        subject TEXT,
                        doc_type TEXT,
                        status TEXT NOT NULL,
                        page_count INT DEFAULT 0,
                        chunk_count INT DEFAULT 0,
                        error_message TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS document_chunks (
                        id TEXT PRIMARY KEY,
                        document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
                        content TEXT NOT NULL,
                        metadata JSONB NOT NULL,
                        embedding vector(768)
                    );
                """)
                conn.commit()
                cur.close()
                conn.close()
            except Exception as e:
                print(f"[CẢNH BÁO] Không thể khởi tạo bảng Supabase pgvector: {str(e)}. Chuyển về Local SQLite/JSONL.")
                self.is_postgres = False

    def get_document_by_hash(self, file_hash: str) -> Optional[Dict[str, Any]]:
        if self.is_postgres:
            try:
                conn = self._get_pg_connection()
                cur = conn.cursor()
                cur.execute("SELECT * FROM documents WHERE file_hash = %s;", (file_hash,))
                row = cur.fetchone()
                cur.close()
                conn.close()
                return dict(row) if row else None
            except Exception:
                pass

        # Local fallback
        with open(self.local_registry_file, "r", encoding="utf-8") as f:
            docs = json.load(f)
        for doc in docs:
            if doc.get("file_hash") == file_hash:
                return doc
        return None

    def save_document_metadata(self, doc_data: Dict[str, Any]) -> Dict[str, Any]:
        doc_data["created_at"] = doc_data.get("created_at") or datetime.now().isoformat()
        doc_data["updated_at"] = datetime.now().isoformat()

        if self.is_postgres:
            try:
                conn = self._get_pg_connection()
                cur = conn.cursor()
                cur.execute("""
                    INSERT INTO documents (
                        id, title, filename, file_hash, file_size_bytes, subject, doc_type, status, page_count, chunk_count, error_message, created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        status = EXCLUDED.status,
                        page_count = EXCLUDED.page_count,
                        chunk_count = EXCLUDED.chunk_count,
                        error_message = EXCLUDED.error_message,
                        updated_at = EXCLUDED.updated_at;
                """, (
                    doc_data["id"], doc_data["title"], doc_data["filename"], doc_data["file_hash"],
                    doc_data["file_size_bytes"], doc_data["subject"], doc_data["doc_type"], doc_data["status"],
                    doc_data.get("page_count", 0), doc_data.get("chunk_count", 0), doc_data.get("error_message"),
                    doc_data["created_at"], doc_data["updated_at"]
                ))
                conn.commit()
                cur.close()
                conn.close()
                return doc_data
            except Exception as e:
                print(f"[CẢNH BÁO] Lưu Supabase thất bại: {str(e)}. Lưu vào registry local.")

        with open(self.local_registry_file, "r", encoding="utf-8") as f:
            docs = json.load(f)
        
        updated = False
        for i, doc in enumerate(docs):
            if doc["id"] == doc_data["id"]:
                docs[i] = doc_data
                updated = True
                break
        if not updated:
            docs.append(doc_data)

        with open(self.local_registry_file, "w", encoding="utf-8") as f:
            json.dump(docs, f, ensure_ascii=False, indent=2)
        return doc_data

    def save_chunks(self, document_id: str, chunks: List[Dict[str, Any]]) -> int:
        """Lưu danh sách chunks vào Supabase hoặc file JSONL local."""
        if not chunks:
            return 0

        if self.is_postgres:
            try:
                conn = self._get_pg_connection()
                cur = conn.cursor()
                cur.execute("DELETE FROM document_chunks WHERE document_id = %s;", (document_id,))
                for c in chunks:
                    cur.execute("""
                        INSERT INTO document_chunks (id, document_id, content, metadata)
                        VALUES (%s, %s, %s, %s);
                    """, (c["id"], document_id, c["content"], json.dumps(c["metadata"], ensure_ascii=False)))
                conn.commit()
                cur.close()
                conn.close()
                return len(chunks)
            except Exception as e:
                print(f"[CẢNH BÁO] Lưu chunks Supabase thất bại: {str(e)}. Lưu sang file JSONL local.")

        # Local JSONL sink: data/processed/<document_id>.jsonl
        jsonl_path = os.path.join(settings.PROCESSED_DIR, f"{document_id}.jsonl")
        with open(jsonl_path, "w", encoding="utf-8") as f:
            for c in chunks:
                f.write(json.dumps(c, ensure_ascii=False) + "\n")

        return len(chunks)

    def list_documents(self) -> List[Dict[str, Any]]:
        if self.is_postgres:
            try:
                conn = self._get_pg_connection()
                cur = conn.cursor()
                cur.execute("SELECT * FROM documents ORDER BY created_at DESC;")
                rows = cur.fetchall()
                cur.close()
                conn.close()
                return [dict(r) for r in rows]
            except Exception:
                pass

        with open(self.local_registry_file, "r", encoding="utf-8") as f:
            docs = json.load(f)
        return sorted(docs, key=lambda x: x.get("created_at", ""), reverse=True)

    def delete_document(self, document_id: str) -> bool:
        if self.is_postgres:
            try:
                conn = self._get_pg_connection()
                cur = conn.cursor()
                cur.execute("DELETE FROM documents WHERE id = %s;", (document_id,))
                conn.commit()
                cur.close()
                conn.close()
            except Exception:
                pass

        # Xóa local JSONL và registry
        jsonl_path = os.path.join(settings.PROCESSED_DIR, f"{document_id}.jsonl")
        if os.path.exists(jsonl_path):
            os.remove(jsonl_path)

        with open(self.local_registry_file, "r", encoding="utf-8") as f:
            docs = json.load(f)
        new_docs = [d for d in docs if d["id"] != document_id]
        with open(self.local_registry_file, "w", encoding="utf-8") as f:
            json.dump(new_docs, f, ensure_ascii=False, indent=2)

        return True

storage_repo = StorageRepository()
storage_repo.init_db()
