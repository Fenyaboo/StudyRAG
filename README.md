# StudyRAG V2 — Trợ lý ôn thi từ tài liệu cá nhân

StudyRAG V2 là hệ thống hỏi đáp (Retrieval-Augmented Generation) chuyên biệt cho học sinh ôn thi lớp 12 môn Toán, Vật lý, và Hóa học. Hệ thống theo nguyên tắc **local-first**, kiểm chứng retrieval trước khi deploy cloud, và có giao diện **Fantasy (Thư viện thiên văn)** lung linh hiện đại.

## Kiến trúc Monorepo

- **Frontend (`frontend/`)**: React + Vite + TypeScript, CSS Variables & CSS Modules theo phong cách Fantasy Astronomical Library.
- **Backend (`backend/`)**: Python 3.11+ + FastAPI, SQLite + SQLModel, ChromaDB local vector store.
- **Data (`data/`)**: Chứa tài liệu PDF thô (`raw/`), dữ liệu trích xuất JSONL (`processed/`) và bộ kiểm thử (`evaluations/`).

---

## Bắt đầu nhanh (Local Development)

### 1. Dùng Makefile & Docker Compose (Khuyến nghị)

Chạy song song cả backend và frontend qua Docker:
```bash
make dev
```
Truy cập Frontend: [http://localhost:5173](http://localhost:5173)  
Truy cập Backend API Docs (Swagger UI): [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 2. Chạy thủ công trên máy (Chân trần)

#### Setup & Chạy Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
uvicorn app.main:app --reload --port 8000
```

#### Setup & Chạy Frontend
Mở một terminal khác:
```bash
cd frontend
npm install
npm run dev
```

---

## Kiểm thử tự động (Testing)

Chạy test toàn bộ dự án:
```bash
make test
```

Hoặc chạy từng module:
- Backend: `cd backend && pytest -v`
- Frontend: `cd frontend && npm test -- --run`

---

## Tình trạng Milestone
- [x] **Milestone 0**: Scaffold monorepo & Fantasy UI Foundation (`/health`, `/ready` status).
- [ ] **Milestone 1**: Document ingestion (Upload, validation, PDF text extraction, chunking).
- [ ] **Milestone 2**: Vector retrieval (ChromaDB, Sentence Transformers embedding, search API).
- [ ] **Milestone 3**: Grounded answer generation (LLM provider, context builder, citations).
- [ ] **Milestone 4**: Quality assurance & evaluations.
- [ ] **Milestone 5**: AWS production deployment.
