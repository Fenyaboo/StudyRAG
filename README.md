# StudyRAG V2

Trợ lý AI ôn thi lớp 12 (Toán, Lý, Hóa) dựa trên tài liệu cá nhân. Hệ thống gồm React/Vite frontend, FastAPI backend, Supabase PostgreSQL + pgvector, private S3 storage và Dify Chatbot API.

## Cấu trúc

- `backend/`: FastAPI, ingest PDF, embedding, hybrid retrieval và Dify streaming.
- `frontend/`: React SPA, landing/auth/dashboard/library/chat/settings.
- `supabase/migrations/`: schema, indexes, RLS và conversation history.
- `deploy/`: Docker Compose, Nginx và script cài VPS.
- `scripts/`: tiện ích phát triển và đánh giá retrieval.

## Trạng thái tính năng AI

Các tính năng AI (embedding, hybrid retrieval, hỏi đáp qua Dify) đang **tạm ngưng**. Backend chạy ở chế độ chỉ lưu trữ: vẫn upload, liệt kê, tải lại và xóa PDF, nhưng không chunk, không embed, không ghi `document_chunks`; `POST /api/v1/chat` trả HTTP 503 với mã lỗi `ai_features_disabled`.

- Biến điều khiển: `AI_FEATURES_ENABLED` trong `backend/.env`, mặc định `false`.
- Giá trị hợp lệ (không phân biệt chữ hoa/thường, bỏ khoảng trắng đầu cuối): `true`, `1`, `yes`, `on` để bật; `false`, `0`, `no`, `off` để tắt. Biến vắng mặt hoặc chỉ chứa khoảng trắng được hiểu là `false`; giá trị ngoài hai tập này làm tiến trình backend dừng ngay lúc khởi động kèm lỗi nêu tên biến.
- Bật lại `AI_FEATURES_ENABLED=true` yêu cầu cài trước tập dependency AI tùy chọn `backend/requirements-ai.txt` (`numpy`, `torch`, `transformers`, `sentence-transformers`): `pip install -r backend/requirements.txt -r backend/requirements-ai.txt`. Không cần sửa code.

Cờ được phân giải đúng một lần lúc khởi động tiến trình, nên thay đổi biến chỉ có hiệu lực sau khi restart backend. Dòng log INFO `AI features enabled: <true|false>` lúc startup và trường `ai_enabled` trong response của `/ready` và `/api/v1/ready` cho biết chế độ hiện tại.

## Trạng thái tài liệu

Cột `documents.status` có đúng năm giá trị:

- `processing`: đã upload và đang được xử lý; đây là trạng thái khởi tạo, không phải trạng thái kết thúc.
- `stored`: đã lưu trữ với `chunk_count = 0` và **chưa lập chỉ mục**, nên tài liệu **không tham gia truy hồi**. Đây là trạng thái kết thúc của ingest khi `AI_FEATURES_ENABLED=false`.
- `ready`: **đã lập chỉ mục** (`chunk_count` bằng số chunk đã lưu) và **tham gia truy hồi**. Chỉ đạt được khi `AI_FEATURES_ENABLED=true`.
- `failed`: xử lý thất bại hoặc vượt `INGEST_TIMEOUT_SECONDS`; `error_message` nêu nguyên nhân. File PDF và document row được giữ nguyên.
- `ocr_required`: PDF không trích xuất được lớp text ở bất kỳ trang nào nên cần OCR trước khi lập chỉ mục; hiện chưa có pipeline OCR.

Tài liệu ở `stored` giữ nguyên object trên S3, `page_count` và document row, nên không mất dữ liệu và sẵn sàng cho lần lập chỉ mục sau khi tính năng AI được bật lại. Bộ lọc `status` của endpoint list document và bộ đếm của endpoint stats nhận đủ năm giá trị này.

## Chạy local

1. Tạo `backend/.env` từ `backend/.env.example` và `frontend/.env` từ `frontend/.env.example`.
2. Apply `supabase/migrations/001_init.sql`, sau đó `supabase/migrations/002_add_stored_document_status.sql` (thêm giá trị `stored`) trong Supabase SQL Editor, theo đúng thứ tự.
3. Cài dependencies: `make install`. Lệnh này tạo/dùng `.venv` cho Python và chạy `npm install` cho frontend.
4. Chạy backend: `PYTHONPATH=backend .venv/bin/uvicorn app.main:app --reload`.
5. Chạy frontend trong terminal khác: `npm --prefix frontend run dev`.

Backend có health endpoints tại `/health`, `/ready`, `/api/v1/health` và `/api/v1/ready`; API protected nằm dưới `/api/v1`.

## Dify setup

Tạo ứng dụng Chatbot và thêm biến workflow/prompt `context`. Backend gửi context retrieval qua `inputs.context`, còn `query` chỉ chứa câu hỏi gốc. Không bật thêm Knowledge Retrieval của Dify vì retrieval chính do backend thực hiện.

## Production

- Frontend: deploy root project lên Vercel, domain `studyrag.bond`.
- Backend: EC2 Ubuntu (khuyến nghị tối thiểu 2 GB RAM), Docker Compose và Nginx tại `api.studyrag.bond`. Lệnh build/chạy, giá trị `AI_FEATURES_ENABLED` cần đặt và cách xác minh: `deploy/README.md`.
- Không commit `.env`, service-role key, Dify key, AWS secret hoặc file PDF người dùng.
- Chỉ mở cổng 22 giới hạn theo IP quản trị, cùng 80/443; không expose cổng 8000.

Xem `implementation_plan.md` để biết bối cảnh sản phẩm và các quyết định kiến trúc ban đầu.

## Kết nối Supabase

1. Tạo project tại Supabase. Vào **Project Settings → API** để lấy `Project URL` và `anon public key`; đặt chúng vào `frontend/.env` dưới tên `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.
2. Vào **Connect → Session pooler**, copy connection string port `5432` vào `backend/.env` dưới tên `DATABASE_URL`. Dùng đúng chuỗi Supabase cung cấp; không dùng Transaction pooler port `6543` với `asyncpg` hiện tại.
3. Đặt `SUPABASE_URL` và `SUPABASE_JWT_ISSUER=https://<project-ref>.supabase.co/auth/v1` trong `backend/.env`. Để `SUPABASE_JWT_SECRET` trống khi project dùng JWKS signing.
4. Vào **SQL Editor**, chạy toàn bộ `supabase/migrations/001_init.sql`, rồi chạy `supabase/migrations/002_add_stored_document_status.sql`.
5. Trong **Authentication → URL Configuration**, thêm `http://localhost:5173/auth`; khi deploy thêm `https://studyrag.bond/auth`.

`SUPABASE_SERVICE_ROLE_KEY` chỉ được đặt trong `backend/.env` hoặc secret manager của VPS, tuyệt đối không đặt trong frontend hay commit vào Git. Sau khi điền env, kiểm tra bằng `make test` và chạy API.

Điều kiện để `/api/v1/ready` báo `ready` phụ thuộc chế độ:

- `AI_FEATURES_ENABLED=false`: chỉ ba kiểm tra `database`, `storage_configured` và `storage_reachable` tham gia phép tính. `dify_configured` và `embedding_configured` vẫn xuất hiện trong `checks` (giá trị `false` khi hai service chưa được khởi tạo) nhưng bị loại khỏi quyết định, nên container không bị coi là chưa sẵn sàng chỉ vì thiếu cấu hình Dify hoặc embedding.
- `AI_FEATURES_ENABLED=true`: cả năm kiểm tra `database`, `storage_configured`, `storage_reachable`, `dify_configured`, `embedding_configured` đều phải `true`.

Response còn có `ai_enabled` bằng đúng giá trị cờ trong tiến trình đang phục vụ request. `/api/v1/health` không đổi và không chứa `ai_enabled`. Chi tiết build, chạy container và cách xác minh: `deploy/README.md`.
