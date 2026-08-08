# StudyRAG V2

Trợ lý AI ôn thi lớp 12 (Toán, Lý, Hóa) dựa trên tài liệu cá nhân. Hệ thống gồm React/Vite frontend, FastAPI backend, Supabase PostgreSQL + pgvector, private S3 storage và Dify Chatbot API.

## Cấu trúc

- `backend/`: FastAPI, ingest PDF, embedding, hybrid retrieval và Dify streaming.
- `frontend/`: React SPA, landing/auth/dashboard/library/chat/settings.
- `supabase/migrations/`: schema, indexes, RLS và conversation history.
- `deploy/`: Docker Compose, Nginx và script cài VPS.
- `scripts/`: tiện ích phát triển và đánh giá retrieval.

## Chạy local

1. Tạo `backend/.env` từ `backend/.env.example` và `frontend/.env` từ `frontend/.env.example`.
2. Apply `supabase/migrations/001_init.sql` trong Supabase SQL Editor.
3. Cài dependencies: `make install`. Lệnh này tạo/dùng `.venv` cho Python và chạy `npm install` cho frontend.
4. Chạy backend: `PYTHONPATH=backend .venv/bin/uvicorn app.main:app --reload`.
5. Chạy frontend trong terminal khác: `npm --prefix frontend run dev`.

Backend có health endpoints tại `/health`, `/ready`, `/api/v1/health` và `/api/v1/ready`; API protected nằm dưới `/api/v1`.

## Dify setup

Tạo ứng dụng Chatbot và thêm biến workflow/prompt `context`. Backend gửi context retrieval qua `inputs.context`, còn `query` chỉ chứa câu hỏi gốc. Không bật thêm Knowledge Retrieval của Dify vì retrieval chính do backend thực hiện.

## Production

- Frontend: deploy root project lên Vercel, domain `studyrag.bond`.
- Backend: EC2 Ubuntu (khuyến nghị tối thiểu 2 GB RAM), Docker Compose và Nginx tại `api.studyrag.bond`.
- Không commit `.env`, service-role key, Dify key, AWS secret hoặc file PDF người dùng.
- Chỉ mở cổng 22 giới hạn theo IP quản trị, cùng 80/443; không expose cổng 8000.

Xem `implementation_plan.md` để biết bối cảnh sản phẩm và các quyết định kiến trúc ban đầu.

## Kết nối Supabase

1. Tạo project tại Supabase. Vào **Project Settings → API** để lấy `Project URL` và `anon public key`; đặt chúng vào `frontend/.env` dưới tên `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.
2. Vào **Connect → Session pooler**, copy connection string port `5432` vào `backend/.env` dưới tên `DATABASE_URL`. Dùng đúng chuỗi Supabase cung cấp; không dùng Transaction pooler port `6543` với `asyncpg` hiện tại.
3. Đặt `SUPABASE_URL` và `SUPABASE_JWT_ISSUER=https://<project-ref>.supabase.co/auth/v1` trong `backend/.env`. Để `SUPABASE_JWT_SECRET` trống khi project dùng JWKS signing.
4. Vào **SQL Editor**, chạy toàn bộ `supabase/migrations/001_init.sql`.
5. Trong **Authentication → URL Configuration**, thêm `http://localhost:5173/auth`; khi deploy thêm `https://studyrag.bond/auth`.

`SUPABASE_SERVICE_ROLE_KEY` chỉ được đặt trong `backend/.env` hoặc secret manager của VPS, tuyệt đối không đặt trong frontend hay commit vào Git. Sau khi điền env, kiểm tra bằng `make test` và chạy API; `/api/v1/ready` chỉ chuyển sang `ready` khi database, S3, Dify và embedding đều được cấu hình.
