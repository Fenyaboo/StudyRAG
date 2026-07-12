# Kiến trúc StudyRAG V2

## 1. Tổng quan kiến trúc Local Development

```text
Browser
  │
  ├── React/Vite :5173 (Giao diện Fantasy Astronomical Library)
  │       │
  │       └── REST API /api/v1
  │
  └── FastAPI :8000
          ├── SQLite: document + history metadata (data/studyrag.db)
          ├── Local filesystem: raw PDF + processed JSONL (data/raw, data/processed)
          ├── ChromaDB: vectors (data/chroma)
          ├── Sentence Transformers: embeddings (Vietnamese bi-encoder)
          └── Ollama / OpenAI-compatible: generation
```

## 2. Các tầng trong Backend (Clean/Layered Architecture)
- `api/routes/`: Tiếp nhận HTTP requests, validation DTO bằng Pydantic schemas.
- `services/`: Chứa nghiệp vụ extraction (`PyMuPDF`), chunking (`Câu 1`, heading overlap), embedding, retrieval, và generation.
- `repositories/`: Giao tiếp với SQLite (`SQLModel`) và ChromaDB.
- `models/`: Định nghĩa thực thể domain (`Document`, `Chunk`, `Conversation`, `Message`, `Citation`).
- `core/`: Config (`Pydantic BaseSettings`), exception handlers, và logging.
