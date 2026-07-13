# StudyRAG V2 — Trợ lý ôn thi từ tài liệu riêng tư

StudyRAG là ứng dụng hỏi đáp từ PDF cho học sinh lớp 12. Mỗi người dùng đăng
nhập qua Supabase, xác nhận email hoặc Google, rồi chỉ có thể xem, tải lên và
hỏi từ thư viện PDF riêng của mình.

## Kiến trúc

- `frontend/`: React, Vite và Supabase Auth. Browser chỉ nhận các biến
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`.
- `backend/`: FastAPI trên Render, xác minh JWT Supabase và truy cập Postgres/
  private Storage bằng service-role key ở phía server.
- `supabase/`: migration cho bucket PDF private, owner-scoped metadata và RLS.

## Chạy local

Tạo một `.env` ở thư mục gốc (hoặc export các biến trong shell) với giá trị từ
Supabase của bạn. `make dev` dừng ngay nếu thiếu biến bắt buộc, để không khởi
chạy một bản không thể đăng nhập. Ba biến đầu là biến public cho Vercel/browser;
phần còn lại là secret của Render/backend:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
VITE_API_BASE_URL=http://localhost:8000/api/v1

# Render/backend only — never expose these in Vercel or the browser.
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-secret>
SUPABASE_JWT_ISSUER=https://<project-ref>.supabase.co/auth/v1
SUPABASE_JWT_AUDIENCE=authenticated
DATABASE_URL=postgresql://<database-user>:<database-password>@<database-host>:5432/postgres
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Sau đó chạy:

```bash
make dev
```

Frontend: [http://localhost:5173](http://localhost:5173) · API docs:
[http://localhost:8000/docs](http://localhost:8000/docs)

Có thể xem tên và mục đích từng biến tại
[frontend/.env.example](frontend/.env.example) và
[backend/.env.example](backend/.env.example). Không copy
`SUPABASE_SERVICE_ROLE_KEY`, password database, hoặc JWT secret vào frontend.

## Kiểm thử

```bash
make test
```

Hoặc chạy riêng:

- Backend: `cd backend && .venv/bin/pytest -q`
- Frontend: `cd frontend && env NODE_ENV=test npm test -- --run && npm run build`

## Triển khai

[docs/deployment-auth.md](docs/deployment-auth.md) là checklist Supabase,
Vercel và Render: xác nhận email bắt buộc, Google OAuth, biến môi trường,
origin CORS và kiểm tra cách ly hai người dùng trước khi công bố URL.
