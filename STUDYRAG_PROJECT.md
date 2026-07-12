# StudyRAG V2 — Trợ lý ôn thi từ tài liệu cá nhân

> Blueprint dùng để bắt đầu project trong VSCode. Đây là nguồn yêu cầu chính cho người phát triển hoặc AI coding agent.

## 0. Trạng thái tài liệu

- Phiên bản: `2.0`
- Trạng thái: sẵn sàng scaffold MVP
- Đối tượng chính: học sinh lớp 12 ôn Toán, Vật lý và Hóa học
- Ngôn ngữ giao diện và câu hỏi: tiếng Việt
- Chiến lược: local-first, kiểm chứng retrieval trước, deploy AWS sau
- Nguyên tắc: không có nguồn phù hợp thì không được tạo câu trả lời chắc chắn

## 1. Tầm nhìn sản phẩm

StudyRAG biến đề thi, sách giáo khoa và tài liệu chuyên đề thành một thư viện có thể hỏi đáp. Hệ thống không đóng vai “AI biết mọi thứ”; nó đóng vai thủ thư ôn thi:

1. Đọc tài liệu người dùng cung cấp.
2. Tìm đúng câu hỏi, bài học hoặc đoạn lý thuyết liên quan.
3. Tổng hợp câu trả lời chỉ từ các đoạn đã tìm được.
4. Gắn nguồn có thể mở lại: tên tài liệu, trang và số câu.
5. Nói rõ khi dữ liệu chưa đủ.

Mục tiêu MVP:

> Nạp 5–10 PDF có lớp chữ, đặt 20 câu hỏi kiểm thử và đạt ít nhất 80% câu có nguồn đúng trong top 5.

## 2. Quyết định đã khóa

Không tự ý đổi các quyết định này trong lúc scaffold MVP:

| Hạng mục | Quyết định MVP | Lý do |
|---|---|---|
| Frontend | React + Vite + TypeScript | Phổ biến, dễ học, build static nhanh |
| Styling | CSS Modules + CSS variables | Kiểm soát giao diện fantasy, ít phụ thuộc |
| Backend | Python 3.11+ + FastAPI | Phù hợp pipeline AI/PDF, có Swagger tự động |
| PDF chữ | PyMuPDF trước, pypdf fallback | Giữ page metadata tốt, tốc độ ổn |
| Chunk storage | JSONL trong local development | Dễ xem và debug |
| Vector store | ChromaDB local | Không cần server riêng cho MVP |
| Embedding | Vietnamese bi-encoder qua Sentence Transformers | Semantic search tiếng Việt, chạy local |
| Metadata/history | SQLite + SQLModel | Nhẹ, có schema rõ và dễ chuyển PostgreSQL |
| LLM local | Ollama provider tùy chọn | Không bắt buộc trả phí |
| LLM cloud | OpenAI-compatible provider tùy chọn | Chỉ bật khi có key ở backend |
| Test backend | pytest | Phù hợp Python |
| Test frontend | Vitest + Testing Library | Kiểm tra component và API state |
| Deploy frontend | AWS Amplify | Nối GitHub và tự build |
| Deploy backend đầu tiên | AWS App Runner | Dễ hơn ECS cho giai đoạn đầu |
| PDF production | Amazon S3 private | Không để file trong container |

Nếu model embedding quá nặng trên máy, được phép dùng TF-IDF làm fallback để hoàn thành Milestone 1–2. Không được gọi TF-IDF là semantic search.

## 3. Phạm vi phiên bản

### 3.1 MVP bắt buộc

- Upload nhiều PDF, tối đa 25 MB/file.
- Chỉ nhận `.pdf`; kiểm tra MIME và magic bytes.
- Trích xuất text theo từng trang.
- Phát hiện PDF scan không có lớp chữ và báo rõ cần OCR.
- Chunk đề thi theo câu; không tách giả thiết khỏi đáp án A–D.
- Chunk sách theo chương, bài, mục, ví dụ; có overlap nhỏ khi cần.
- Cho phép người dùng chỉnh metadata trước hoặc sau ingest.
- Lập chỉ mục vector và hỗ trợ metadata filter.
- Hỏi bằng tiếng Việt và nhận top-k đoạn liên quan.
- Trả lời kèm citation thật.
- Có chế độ debug hiển thị chunk, score và metadata.
- Quản lý danh sách tài liệu và xóa/re-index tài liệu.
- Lưu lịch sử câu hỏi local.
- Giao diện fantasy responsive.
- Có test cho parser, chunker, retrieval, API và các UI state chính.

### 3.2 Sau MVP

- OCR PDF scan.
- Hybrid search: vector + BM25.
- Cross-encoder reranking.
- Tự động tag môn/chủ đề/dạng bài.
- Highlight citation trực tiếp trên PDF.
- Tạo câu hỏi tương tự và flashcard.
- Theo dõi dạng bài thường sai.
- Tài khoản và đồng bộ đa thiết bị.
- Chia sẻ thư viện hoặc lớp học.

### 3.3 Không làm trong V2 đầu tiên

- Fine-tune LLM.
- Thanh toán.
- Mạng xã hội học tập.
- Hỗ trợ hàng nghìn người dùng đồng thời.
- Cho LLM tự bổ sung kiến thức ngoài tài liệu mà không gắn nhãn.

## 4. User stories chính

### US-01 — Nạp tài liệu

Là học sinh, tôi muốn tải đề thi hoặc sách PDF để hệ thống biến nó thành tài liệu có thể tìm kiếm.

Tiêu chí:

- Thấy tiến trình `upload → extracting → chunking → embedding → ready`.
- Khi lỗi, biết lỗi thuộc file quá lớn, PDF scan, PDF hỏng hay backend mất kết nối.
- Upload lại cùng file không tạo dữ liệu trùng; hệ thống hỏi re-index hoặc bỏ qua.

### US-02 — Hỏi từ thư viện

Là học sinh, tôi muốn hỏi một câu bằng tiếng Việt và nhận câu trả lời bám sát tài liệu.

Tiêu chí:

- Có câu trả lời hoặc thông báo thiếu dữ liệu.
- Mỗi ý quan trọng có citation.
- Có thể mở phần nguồn để xem đoạn gốc, trang và điểm retrieval.

### US-03 — Lọc phạm vi

Là học sinh, tôi muốn chỉ hỏi trong môn, chủ đề hoặc tài liệu đã chọn.

Tiêu chí:

- Bộ lọc môn, lớp, chủ đề và tài liệu hoạt động ở retrieval layer.
- UI hiển thị rõ phạm vi đang dùng.

### US-04 — Kiểm chứng AI

Là người học, tôi muốn thấy AI dựa vào đoạn nào để đánh giá câu trả lời có đáng tin không.

Tiêu chí:

- Debug mode hiển thị top-k.
- Citation không được trỏ tới chunk không nằm trong context gửi LLM.
- Nếu score dưới ngưỡng, hệ thống từ chối trả lời chắc chắn.

### US-05 — Quản lý thư viện

Là học sinh, tôi muốn xem, sửa metadata, xóa hoặc re-index tài liệu.

Tiêu chí:

- Xóa tài liệu phải xóa file, chunk, vector và metadata liên quan.
- Hành động xóa cần xác nhận.

## 5. Trải nghiệm và giao diện

### 5.1 Concept đã chọn

“Thư viện thiên văn”: fantasy vừa phải, nền xanh đêm/tím, điểm sáng vàng, card kính, tiêu đề serif và nội dung sans-serif. Giao diện phải giống sản phẩm học tập trước, fantasy sau.

### 5.2 Design tokens ban đầu

```css
:root {
  --color-bg: #0b1022;
  --color-surface: #151b36;
  --color-surface-raised: #1b2342;
  --color-text: #f4f1ff;
  --color-muted: #9298bb;
  --color-primary: #8d7aff;
  --color-accent: #f7c56b;
  --color-success: #74d4ad;
  --color-danger: #ef7c8e;
  --radius-card: 16px;
  --shadow-card: 0 18px 50px rgba(0, 0, 0, 0.24);
}
```

### 5.3 Màn hình

#### Dashboard

- Tổng số tài liệu, chunk và câu hỏi gần đây.
- Ask box lớn.
- Các collection Toán/Lý/Hóa.
- Tài liệu mới nạp và tiến trình ingest.

#### Library

- Danh sách tài liệu dạng card/table tùy kích thước màn hình.
- Search, filter, sort.
- Upload dropzone.
- Trạng thái: processing, ready, error.
- Actions: xem metadata, re-index, xóa.

#### Study chat

- Luồng câu hỏi/câu trả lời.
- Bộ lọc phạm vi ở trên input.
- Citation dạng chip có thể mở rộng.
- Debug drawer chứa retrieved chunks.
- Nút copy, hỏi tiếp và đánh giá câu trả lời.

#### History

- Nhóm theo ngày.
- Search câu hỏi cũ.
- Mở lại phiên và xóa lịch sử.

#### Settings

- Chọn provider LLM.
- Chọn embedding model.
- Bật/tắt debug retrieval.
- Hiển thị trạng thái backend, vector DB và provider.
- Không hiển thị toàn bộ secret đã lưu.

### 5.4 UI states bắt buộc

- Loading skeleton.
- Empty library.
- Empty retrieval.
- Upload progress.
- Ingest success.
- Invalid file.
- PDF scan/no text.
- API disconnected.
- LLM unavailable nhưng retrieval vẫn hoạt động.
- Confirm delete.
- Mobile sidebar/drawer.

### 5.5 Accessibility

- Tương phản tối thiểu WCAG AA cho text chính.
- Có focus ring rõ.
- Mọi action dùng được bằng bàn phím.
- Không dùng màu sắc làm tín hiệu duy nhất.
- Animation tôn trọng `prefers-reduced-motion`.

## 6. Kiến trúc hệ thống

### 6.1 Local development

```text
Browser
  │
  ├── React/Vite :5173
  │       │
  │       └── REST /api
  │
  └── FastAPI :8000
          ├── SQLite: document + history metadata
          ├── Local filesystem: raw PDF + processed JSONL
          ├── ChromaDB: vectors
          ├── Sentence Transformers: embeddings
          └── Ollama/OpenAI-compatible: optional answer generation
```

### 6.2 AWS production sau MVP

```text
GitHub
  ├── AWS Amplify ── React frontend
  └── CI pipeline ── App Runner backend
                         ├── S3 private PDF storage
                         ├── PostgreSQL/RDS metadata
                         ├── managed vector store hoặc pgvector
                         ├── Secrets Manager
                         └── CloudWatch logs
```

Không deploy Chroma local vào nhiều replica App Runner. Khi cần scale nhiều instance, chuyển vector store sang pgvector, OpenSearch hoặc Qdrant server.

## 7. Cấu trúc repository mục tiêu

```text
studyrag/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── chat/
│   │   │   ├── documents/
│   │   │   ├── history/
│   │   │   └── settings/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── services/api.ts
│   │   ├── styles/
│   │   └── types/
│   ├── tests/
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── app/
│   │   ├── api/routes/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── schemas/
│   │   ├── services/
│   │   │   ├── extraction/
│   │   │   ├── chunking/
│   │   │   ├── embedding/
│   │   │   ├── retrieval/
│   │   │   └── generation/
│   │   └── main.py
│   ├── tests/
│   ├── migrations/
│   ├── .env.example
│   ├── pyproject.toml
│   └── Dockerfile
├── data/
│   ├── raw/.gitkeep
│   ├── processed/.gitkeep
│   └── evaluations/questions.jsonl
├── docs/
│   ├── architecture.md
│   └── deployment-aws.md
├── scripts/
│   ├── seed_demo.py
│   └── evaluate_retrieval.py
├── .github/workflows/
│   ├── ci.yml
│   └── deploy-frontend.yml
├── docker-compose.yml
├── Makefile
├── .gitignore
└── README.md
```

## 8. Domain model

### 8.1 Document

```text
id: UUID
filename: string
display_name: string
sha256: string, unique per user/library
mime_type: string
size_bytes: integer
subject: enum(math, physics, chemistry, other)
grade: integer nullable
topic: string nullable
document_type: enum(exam, textbook, theory, notes, other)
status: enum(uploaded, extracting, chunking, embedding, ready, failed)
page_count: integer nullable
chunk_count: integer default 0
error_code: string nullable
error_message: string nullable
created_at: datetime
updated_at: datetime
```

### 8.2 Chunk

```text
id: UUID
document_id: UUID
text: string
page_start: integer
page_end: integer
chunk_index: integer
chunk_type: enum(question, theory, example, section, fallback)
question_number: string nullable
chapter: string nullable
lesson: string nullable
topic: string nullable
token_count: integer
content_hash: string
vector_id: string
```

### 8.3 Conversation

```text
id: UUID
title: string
created_at: datetime
updated_at: datetime
```

### 8.4 Message

```text
id: UUID
conversation_id: UUID
role: enum(user, assistant)
content: string
retrieval_debug: JSON nullable
created_at: datetime
```

### 8.5 Citation

```text
id: UUID
message_id: UUID
chunk_id: UUID
rank: integer
similarity_score: float
quoted_text: string
```

## 9. Pipeline ingest

### 9.1 Upload validation

1. Giới hạn mặc định 25 MB.
2. Kiểm tra extension, MIME và header `%PDF`.
3. Tính SHA-256 để phát hiện file trùng.
4. Đổi tên file lưu trữ thành UUID; chỉ giữ tên gốc trong metadata.
5. Không tin filename từ client, chống path traversal.

### 9.2 Extraction

- Trích text từng trang và giữ page number.
- Ghi lại tỷ lệ trang không có text.
- Nếu trên 80% trang không có text, đánh dấu `OCR_REQUIRED`.
- Không im lặng trả về zero chunks.
- Chuẩn hóa Unicode NFC, whitespace và ký tự xuống dòng.
- Giữ công thức, ký hiệu và lựa chọn A/B/C/D tối đa có thể.

### 9.3 Chunking strategy

#### Đề thi

- Regex nhận diện `Câu 1`, `Câu 1.`, `Câu 1:`, `Bài 1`.
- Một câu gồm giả thiết, nội dung, đáp án và lời giải nếu có.
- Nếu một câu qua nhiều trang, merge theo question number.
- Chunk quá dài mới chia nhỏ, có overlap và cùng question metadata.

#### Sách/chuyên đề

- Ưu tiên heading: chương → bài → mục → ví dụ.
- Target 350–700 tokens/chunk.
- Overlap 60–100 tokens.
- Không tách heading khỏi đoạn đầu tiên.

#### Fallback

- Chia theo paragraph/sentence.
- Target 500 tokens, overlap 80 tokens.
- Không dùng cắt cứng số ký tự nếu có thể tránh.

### 9.4 Embedding/indexing

- Batch embedding để giảm thời gian.
- Vector ID phải truy ngược được chunk ID.
- Lưu tên model và embedding dimension trong collection metadata.
- Đổi embedding model phải tạo collection mới hoặc re-index toàn bộ.
- Chỉ chuyển document sang `ready` khi mọi chunk đã index thành công.

## 10. Retrieval và answer generation

### 10.1 Retrieval V1

1. Validate câu hỏi.
2. Áp dụng filter môn/tài liệu/chủ đề.
3. Embed query.
4. Lấy top 12 từ ChromaDB.
5. Loại chunk trùng hoặc gần trùng.
6. Chọn tối đa 5 chunk đưa vào context.
7. Nếu top score dưới ngưỡng cấu hình, trả insufficient context.

Không hiển thị score dạng phần trăm “độ đúng”. Score chỉ là độ tương đồng retrieval.

### 10.2 Retrieval V2 sau MVP

```text
Query
  ├── semantic vector search ─┐
  └── BM25 keyword search ────┼── reciprocal rank fusion
                              └── reranker top 20 → top 5
```

### 10.3 Generation rules

- LLM chỉ nhận các chunk cuối cùng cùng metadata.
- Citation ID dùng marker ổn định như `[S1]`, `[S2]`.
- Backend kiểm tra mọi citation trong output có tồn tại trong context.
- Nếu LLM tạo citation lạ, loại câu trả lời và retry một lần.
- Nếu retrieval không đủ, không gọi LLM.
- Có timeout và fallback hiển thị retrieved passages.

### 10.4 System prompt

```text
Bạn là StudyRAG, trợ lý ôn thi lớp 12.

QUY TẮC BẮT BUỘC:
1. Chỉ dùng thông tin trong CONTEXT.
2. Không bổ sung công thức, dữ kiện hoặc kết luận ngoài CONTEXT.
3. Mỗi nhận định quan trọng phải có citation [Sx].
4. Nếu CONTEXT không đủ, trả lời đúng câu:
   "Tài liệu hiện có chưa đủ để trả lời chắc chắn."
5. Nếu các nguồn mâu thuẫn, nêu rõ nguồn nào nói gì.
6. Trả lời bằng tiếng Việt, rõ ràng và phù hợp học sinh lớp 12.

CONTEXT:
{context}

QUESTION:
{question}
```

## 11. API contract V1

Base URL local: `http://localhost:8000/api/v1`

### System

```text
GET /health
GET /ready
```

### Documents

```text
POST   /documents
GET    /documents
GET    /documents/{document_id}
PATCH  /documents/{document_id}
POST   /documents/{document_id}/reindex
DELETE /documents/{document_id}
```

Upload dùng `multipart/form-data`:

```text
file: PDF
subject: math | physics | chemistry | other
grade: 12
document_type: exam | textbook | theory | notes | other
topic: optional string
```

### Retrieval

```text
POST /search
POST /answer
```

Request `/search`:

```json
{
  "query": "Cách dựng chân đường vuông góc?",
  "top_k": 5,
  "filters": {
    "subject": "math",
    "document_ids": []
  }
}
```

Response `/search`:

```json
{
  "query": "Cách dựng chân đường vuông góc?",
  "results": [
    {
      "chunk_id": "uuid",
      "document_id": "uuid",
      "document_name": "Chuyên đề khoảng cách.pdf",
      "text": "...",
      "page_start": 15,
      "page_end": 15,
      "question_number": null,
      "score": 0.82,
      "rank": 1
    }
  ]
}
```

Request `/answer`:

```json
{
  "question": "Dạng chân đường vuông góc thường giải thế nào?",
  "conversation_id": null,
  "top_k": 5,
  "debug": true,
  "filters": {
    "subject": "math"
  }
}
```

Response `/answer`:

```json
{
  "answer": "... [S1]",
  "conversation_id": "uuid",
  "message_id": "uuid",
  "citations": [
    {
      "id": "S1",
      "document_id": "uuid",
      "document_name": "Chuyên đề khoảng cách.pdf",
      "page_start": 15,
      "page_end": 15,
      "question_number": null,
      "quote": "..."
    }
  ],
  "retrieval": {
    "model": "embedding-model-name",
    "results": []
  }
}
```

### History

```text
GET    /conversations
GET    /conversations/{conversation_id}
DELETE /conversations/{conversation_id}
```

### Error shape thống nhất

```json
{
  "error": {
    "code": "OCR_REQUIRED",
    "message": "PDF gần như không có lớp văn bản.",
    "details": {}
  },
  "request_id": "uuid"
}
```

Error code tối thiểu:

- `INVALID_FILE_TYPE`
- `FILE_TOO_LARGE`
- `DUPLICATE_DOCUMENT`
- `PDF_PARSE_FAILED`
- `OCR_REQUIRED`
- `INGEST_FAILED`
- `DOCUMENT_NOT_READY`
- `NO_RETRIEVAL_RESULTS`
- `LLM_UNAVAILABLE`
- `RATE_LIMITED`

## 12. Cấu hình và secret

Frontend `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Backend `.env.example`:

```env
APP_ENV=development
APP_HOST=0.0.0.0
APP_PORT=8000
FRONTEND_ORIGINS=http://localhost:5173
DATABASE_URL=sqlite:///./data/studyrag.db
CHROMA_PATH=./data/chroma
UPLOAD_DIR=./data/raw
PROCESSED_DIR=./data/processed
MAX_UPLOAD_MB=25
EMBEDDING_PROVIDER=sentence_transformers
EMBEDDING_MODEL=bkai-foundation-models/vietnamese-bi-encoder
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=
OPENAI_API_KEY=
OPENAI_MODEL=
RETRIEVAL_TOP_K=5
RETRIEVAL_MIN_SCORE=0.25
LOG_LEVEL=INFO
```

Quy tắc:

- Không commit `.env`.
- Không gửi API key xuống browser.
- Không log toàn bộ tài liệu hoặc prompt chứa dữ liệu riêng tư.
- Production secret nằm trong AWS Secrets Manager/App Runner secrets.

## 13. Security và privacy

- Sanitize filename và không dùng filename làm path trực tiếp.
- Giới hạn file size, request body và timeout.
- Chống zip bomb không liên quan vì chỉ nhận PDF, nhưng vẫn giới hạn page count.
- Không render HTML từ LLM bằng `dangerouslySetInnerHTML` nếu chưa sanitize.
- CORS local chỉ cho `localhost:5173`; production chỉ cho domain Amplify/custom domain.
- S3 bucket private, bật encryption và block public access.
- URL tải/xem PDF dùng presigned URL có thời hạn.
- Xóa document phải xóa object, chunk, vector và citation liên quan.
- API production phải có rate limit.
- Trước khi có auth, không quảng bá app như dịch vụ công khai để lưu tài liệu riêng tư.

## 14. Logging và quan sát

Mỗi request có `request_id`. Log JSON gồm:

- endpoint và status code;
- thời gian extraction/chunking/embedding/retrieval/generation;
- document ID, không log toàn text;
- số chunk và token;
- provider/model;
- error code.

Không log:

- API key;
- toàn bộ PDF;
- prompt đầy đủ trong production;
- dữ liệu cá nhân không cần thiết.

## 15. Test strategy

### 15.1 Unit tests

- PDF parser giữ đúng page number.
- Cleaner không phá ký hiệu Toán/Lý/Hóa cơ bản.
- Chunker tách đúng `Câu 1`, `Câu 2`.
- Chunker không tách A–D khỏi câu hỏi.
- Chunker merge câu qua hai trang.
- Content hash ổn định.
- Citation validator chặn citation không có trong context.

### 15.2 Integration tests

- Upload PDF → document ready → search có kết quả.
- Upload file trùng → `DUPLICATE_DOCUMENT`.
- PDF scan → `OCR_REQUIRED`.
- Xóa document → không còn vector/chunk.
- LLM timeout → fallback retrieval passages.

### 15.3 Frontend tests

- Upload success/error/processing.
- Empty library.
- Ask loading/answer/insufficient context/error.
- Citation drawer mở đúng nguồn.
- Filter được gửi đúng API payload.
- Mobile navigation hoạt động.

### 15.4 Retrieval evaluation

File `data/evaluations/questions.jsonl`:

```json
{"id":"math-001","question":"Cách tìm khoảng cách từ điểm đến mặt phẳng?","expected_document":"chuyen_de_khoang_cach.pdf","expected_pages":[15]}
```

Chỉ số:

- Recall@5 ≥ 0.80 trên bộ 20 câu đầu tiên.
- Mean Reciprocal Rank được ghi lại để so sánh model.
- Citation precision mục tiêu 1.0: citation phải trỏ đúng chunk đã dùng.
- Tỷ lệ từ chối đúng với câu ngoài tài liệu.

## 16. Roadmap thực thi

### Milestone 0 — scaffold, 1 phiên

- [ ] Tạo monorepo theo cây thư mục.
- [ ] Khởi tạo React/Vite/TypeScript.
- [ ] Khởi tạo FastAPI và config.
- [ ] Thêm lint, format, test và `.env.example`.
- [ ] Thêm `/health` và màn hình API status.
- [ ] Thêm README lệnh chạy.

Hoàn thành khi frontend và backend cùng chạy, frontend hiển thị backend online.

### Milestone 1 — document ingestion, 2–3 phiên

- [ ] Upload dropzone.
- [ ] File validation và SHA-256.
- [ ] Document schema + SQLite.
- [ ] Extract text theo trang.
- [ ] Chunk đề thi và fallback chunker.
- [ ] Lưu JSONL processed.
- [ ] UI progress/status/error.

Hoàn thành khi nạp được 3 PDF chữ và kiểm tra thủ công chunk/page metadata đúng.

### Milestone 2 — retrieval, 2 phiên

- [ ] Embedding provider interface.
- [ ] Sentence Transformers provider.
- [ ] Chroma repository.
- [ ] Search endpoint + filters.
- [ ] Debug retrieval UI.
- [ ] Bộ 20 câu evaluation.

Hoàn thành khi Recall@5 đạt ít nhất 0.80 hoặc có báo cáo rõ nguyên nhân chưa đạt.

### Milestone 3 — grounded answer, 2 phiên

- [ ] LLM provider interface.
- [ ] Ollama provider.
- [ ] OpenAI-compatible provider tùy chọn.
- [ ] Context builder và token budget.
- [ ] Citation parser/validator.
- [ ] Insufficient-context gate.
- [ ] Chat UI và history.

Hoàn thành khi câu trả lời có citation thật và câu ngoài tài liệu bị từ chối.

### Milestone 4 — quality, 1–2 phiên

- [ ] Responsive và accessibility pass.
- [ ] Security validation.
- [ ] Unit/integration/frontend tests.
- [ ] Error copy tiếng Việt.
- [ ] Seed demo và reset script.
- [ ] Docker Compose local.

Hoàn thành khi máy mới có thể setup theo README và chạy test thành công.

### Milestone 5 — AWS, thực hiện sau khi local ổn định

- [ ] Push GitHub và bật branch protection.
- [ ] Amplify frontend.
- [ ] Docker image backend.
- [ ] App Runner backend.
- [ ] S3 private bucket.
- [ ] Secret/environment configuration.
- [ ] CloudWatch logs.
- [ ] CORS production.
- [ ] Smoke test domain public.
- [ ] Billing budget/alarm trước khi dùng dịch vụ có phí.

## 17. Local commands mục tiêu

Sau khi scaffold, trải nghiệm chạy local cần đơn giản như sau:

```bash
make setup
make dev
make test
make evaluate
```

Nếu không dùng Make:

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
uvicorn app.main:app --reload --port 8000

# Frontend ở terminal khác
cd frontend
npm install
npm run dev
```

## 18. CI/CD

Pull request phải chạy:

- Backend lint/type/test.
- Frontend lint/type/test/build.
- Không cần model embedding thật trong unit test; dùng fake provider.
- Integration model test chạy riêng hoặc theo workflow thủ công.

Deploy rules:

- `main` deploy frontend staging.
- Production dùng manual approval ban đầu.
- Migration database chạy một lần trước app rollout.
- Có health check và rollback về image/build trước.

## 19. Chiến lược rollback

- Code: redeploy commit/tag trước.
- Frontend Amplify: redeploy build trước.
- Backend App Runner: deploy image tag trước.
- Database: migration có downgrade hoặc backup trước migration nguy hiểm.
- Vector index: giữ collection cũ đến khi collection mới vượt evaluation.
- PDF: không xóa bản cũ trong lúc re-index; chỉ thay pointer khi hoàn tất.

## 20. Definition of Done cho MVP

MVP chỉ được gọi là hoàn thành khi tất cả điều sau đúng:

- [ ] Setup từ README trên máy sạch thành công.
- [ ] Frontend và backend chạy local.
- [ ] Upload ít nhất 5 PDF có lớp chữ.
- [ ] PDF scan trả lỗi rõ ràng.
- [ ] Chunk đề thi giữ câu hỏi và đáp án cùng nhau.
- [ ] Metadata trang/tài liệu truy ngược được.
- [ ] Search top 5 đạt mục tiêu evaluation.
- [ ] Answer chỉ dùng retrieved context.
- [ ] Mọi citation hợp lệ và mở được nguồn.
- [ ] Câu ngoài dữ liệu bị từ chối đúng.
- [ ] Xóa document dọn đủ file/chunk/vector.
- [ ] Loading, empty, success và error states hoạt động.
- [ ] Mobile layout dùng được.
- [ ] Test backend/frontend pass.
- [ ] Frontend production build pass.
- [ ] Không có secret trong Git.
- [ ] Có hướng dẫn AWS và rollback.

## 21. Quy tắc cho AI coding agent trong VSCode

Khi dùng Copilot/Codex/AI agent để xây project, đưa file này làm context và yêu cầu agent tuân thủ:

1. Làm đúng một milestone mỗi lần.
2. Trước khi code, đọc cây thư mục và nêu file sẽ tạo/sửa.
3. Không đổi stack hoặc scope đã khóa nếu chưa được đồng ý.
4. Không hard-code secret.
5. Mọi endpoint có schema và error handling.
6. Mọi thay đổi pipeline phải có test.
7. Sau mỗi milestone phải chạy test/build và báo kết quả thật.
8. Không đánh dấu xong nếu chỉ có giao diện mock.
9. Không đưa API trả phí vào luồng bắt buộc.
10. Giữ code dễ đọc cho người mới: hàm ngắn, tên rõ, comment phần khó.

### Prompt khởi động đề xuất

```text
Đọc toàn bộ STUDYRAG_PROJECT.md và bắt đầu Milestone 0.

Yêu cầu:
- Giữ nguyên stack và scope đã khóa.
- Tạo cấu trúc monorepo frontend/backend hoàn chỉnh.
- Chỉ dùng dữ liệu demo tối thiểu để kiểm tra kết nối.
- Tạo health endpoint, API client và màn hình trạng thái backend.
- Thêm lint, format, test cơ bản, env example và README.
- Chạy test và production build trước khi kết luận.
- Không bắt đầu Milestone 1 khi Milestone 0 chưa đạt tiêu chí hoàn thành.
```

## 22. Tiêu chí ưu tiên khi phải cắt scope

Nếu thiếu thời gian, giữ theo thứ tự:

1. Truy xuất đúng tài liệu và trang.
2. Không bịa khi thiếu context.
3. Upload/chunk/index ổn định.
4. Citation kiểm chứng được.
5. UX rõ và responsive.
6. Lịch sử học tập.
7. Hiệu ứng fantasy.

Không hy sinh độ đúng retrieval để thêm animation hoặc tính năng trang trí.
