import json
import os
import re
import unicodedata
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.core.config import settings


_QUERY_STOP_WORDS = {
    "a", "an", "ba", "cua", "cho", "den", "duoc", "duoi", "gi", "hay", "la", "mot",
    "nao", "nhung", "o", "phan", "the", "theo", "trang", "tren", "trong", "tu", "va", "ve",
    "vi", "voi", "cau", "bai", "du", "tinh", "cach", "dung", "hoan", "khong", "noi", "tai", "toan", "ton",
}
_PAGE_PATTERN = re.compile(r"\b(?:trang|page)\s*(\d+)\b")
_QUESTION_PATTERN = re.compile(r"\b(?:cau|bai)\s*(\d+)\b")


def _normalise_text(value: Any) -> str:
    """Chuẩn hóa tiếng Việt và dấu câu để so khớp retrieval ổn định hơn."""
    text = unicodedata.normalize("NFD", str(value or "").lower()).replace("đ", "d")
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _tokenise(value: Any) -> set[str]:
    return set(re.findall(r"[a-z]+|\d+", _normalise_text(value)))


def _query_features(query_text: str) -> tuple[set[str], Optional[int], Optional[str]]:
    normalised = _normalise_text(query_text)
    tokens = _tokenise(normalised)
    terms = {
        token for token in tokens
        if not token.isdigit() and len(token) > 1 and token not in _QUERY_STOP_WORDS
    }
    page_match = _PAGE_PATTERN.search(normalised)
    question_match = _QUESTION_PATTERN.search(normalised)
    return terms, int(page_match.group(1)) if page_match else None, question_match.group(1) if question_match else None


def _score_chunk(
    query_terms: set[str],
    requested_page: Optional[int],
    requested_question: Optional[str],
    content: str,
    metadata: Dict[str, Any],
) -> float:
    """Chấm lexical score có ưu tiên cho section, số trang và số câu được hỏi."""
    content_terms = _tokenise(content)
    section_terms = _tokenise(metadata.get("section_title") or metadata.get("section"))
    content_matches = query_terms & content_terms
    section_matches = query_terms & section_terms
    question_number = str(metadata.get("question_number") or "")
    question_matches = requested_question is not None and question_number == requested_question

    # Không đưa chunk không có bằng chứng textual vào LLM chỉ vì nó đủ dài.
    if not content_matches and not section_matches and not question_matches:
        return 0.0

    score = min(0.68, 0.28 * len(content_matches))
    score += min(0.18, 0.1 * len(section_matches))

    if requested_page is not None:
        page = metadata.get("page_number") or metadata.get("page")
        if str(page) == str(requested_page):
            score += 0.28

    if question_matches:
        score += 0.24

    # Nhiều từ khóa trùng khớp là tín hiệu mạnh hơn một từ đơn lẻ.
    if len(content_matches | section_matches) >= 2:
        score += 0.08

    return min(round(score, 4), 1.0)


class StorageRepository:
    """
    Storage Engine cho StudyRAG:
    - Nếu sử dụng Supabase (VECTOR_STORE_TYPE == 'supabase_pgvector' hoặc DATABASE_URL có postgresql):
      Lưu trữ trên cloud PostgreSQL với pgvector.
    - Nếu sử dụng Local (sqlite_chroma):
      Lưu metadata/chunks trên JSONL và truy xuất lexical có chuẩn hóa tiếng Việt.
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

    def search(
        self,
        query_text: str,
        top_k: int = 5,
        min_score: float = 0.25,
        document_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Tìm các chunks có bằng chứng textual, ưu tiên đúng tài liệu/trang được hỏi."""
        results: List[Dict[str, Any]] = []
        query_terms, requested_page, requested_question = _query_features(query_text)
        if not query_terms and requested_question is None:
            return []

        # 1. Supabase/PostgreSQL. Lọc document trước khi giới hạn top_k để không làm rơi kết quả đúng.
        if self.is_postgres:
            try:
                conn = self._get_pg_connection()
                cur = conn.cursor()
                where_clauses = ["d.status = %s"]
                params: List[Any] = ["ready"]
                if document_id:
                    where_clauses.append("c.document_id = %s")
                    params.append(document_id)
                cur.execute(
                    f"""
                    SELECT c.id, c.document_id, c.content, c.metadata, d.filename, d.title
                    FROM document_chunks c
                    JOIN documents d ON c.document_id = d.id
                    WHERE {' AND '.join(where_clauses)}
                    LIMIT 200;
                    """,
                    tuple(params),
                )
                rows = cur.fetchall()
                cur.close()
                conn.close()

                for row in rows:
                    content = row["content"] or ""
                    metadata = row["metadata"]
                    if isinstance(metadata, str):
                        try:
                            metadata = json.loads(metadata)
                        except json.JSONDecodeError:
                            metadata = {}
                    metadata = metadata or {}
                    score = _score_chunk(query_terms, requested_page, requested_question, content, metadata)
                    if score >= min_score:
                        results.append({
                            "id": row["id"],
                            "document_id": row["document_id"],
                            "file_name": row["filename"] or row["title"] or "Tài liệu",
                            "page": metadata.get("page_number") or metadata.get("page", 1),
                            "content": content,
                            "score": score,
                        })
                results.sort(key=lambda item: (-item["score"], item["page"]))
                return results[:top_k]
            except Exception as error:
                print(f"[CẢNH BÁO] Tìm kiếm Supabase lỗi: {str(error)}. Chuyển sang tìm kiếm Local JSONL.")

        # 2. Local JSONL. Chỉ đọc chunks thuộc tài liệu đang ở trạng thái ready.
        ready_documents = {
            document["id"]: document
            for document in self.list_documents()
            if document.get("status") == "ready"
        }
        if not os.path.exists(settings.PROCESSED_DIR):
            return []

        for filename in os.listdir(settings.PROCESSED_DIR):
            if not filename.endswith(".jsonl"):
                continue
            current_document_id = filename[:-6]
            if document_id and current_document_id != document_id:
                continue
            document = ready_documents.get(current_document_id)
            if not document:
                continue
            file_name = document.get("filename") or document.get("title") or f"Tài liệu ({current_document_id[:6]})"
            path = os.path.join(settings.PROCESSED_DIR, filename)

            try:
                with open(path, "r", encoding="utf-8") as file:
                    for line in file:
                        if not line.strip():
                            continue
                        chunk = json.loads(line)
                        content = chunk.get("content") or chunk.get("text", "")
                        metadata = chunk.get("metadata", {}) or {}
                        score = _score_chunk(query_terms, requested_page, requested_question, content, metadata)
                        if score >= min_score:
                            results.append({
                                "id": chunk.get("id", f"{current_document_id}_{len(results)}"),
                                "document_id": current_document_id,
                                "file_name": file_name,
                                "page": metadata.get("page_number") or metadata.get("page", 1),
                                "content": content,
                                "score": score,
                            })
            except (OSError, json.JSONDecodeError) as error:
                print(f"[LỖI] Đọc file {filename}: {str(error)}")

        results.sort(key=lambda item: (-item["score"], item["page"]))
        return results[:top_k]

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

    def has_ready_documents(self, document_id: Optional[str] = None) -> bool:
        """Cho query route biết có corpus thật để tránh gọi LLM với context rỗng."""
        return any(
            document.get("status") == "ready" and (document_id is None or document.get("id") == document_id)
            for document in self.list_documents()
        )

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
