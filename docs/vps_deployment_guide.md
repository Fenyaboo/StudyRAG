# Hướng Dẫn Triển Khai Examoras Backend & Docker Dashboard Trên VPS

Tài liệu này hướng dẫn chi tiết cách triển khai toàn bộ hệ thống Backend và Web Dashboard quản lý Docker lên VPS Ubuntu/Debian:
- **`api.examoras.site`**: Máy chủ FastAPI Backend (xử lý RAG, Agentic StateGraph, Tencent COS, Supabase).
- **`backend.examoras.site`**: Bảng điều khiển Web **Portainer CE** (xem trạng thái container, CPU/RAM, xem logs trực tiếp, bật/tắt và cấu hình Docker từ xa).

---

## 1. Cấu hình DNS trên Cloudflare / Nhà cung cấp Domain

Truy cập trang quản lý DNS của `examoras.site` và thêm **2 bản ghi `A`** trỏ về địa chỉ IP của máy chủ VPS của bạn:

| Loại (Type) | Tên / Host | Giá trị đích (Target / IP) | Proxy Status | Ghi chú |
|---|---|---|---|---|
| **A** | `api` | **`<IP_VPS_CỦA_BẠN>`** *(ví dụ `119.28.xx.xx`)* | **DNS Only** (Xám) | Cho API Backend |
| **A** | `backend` | **`<IP_VPS_CỦA_BẠN>`** *(ví dụ `119.28.xx.xx`)* | **DNS Only** (Xám) | Cho Docker Web Dashboard |

> [!NOTE]
> Ban đầu nên để đám mây **DNS Only (màu xám)** để Certbot xác thực và cấp chứng chỉ SSL Let's Encrypt trực tiếp cho VPS.

---

## 2. Các Bước Cài Đặt Trên VPS (Chỉ mất 3-5 phút)

### Bước 1: Đăng nhập vào VPS qua SSH
Mở PowerShell hoặc Terminal trên máy tính:
```bash
ssh root@<IP_VPS_CỦA_BẠN>
```

### Bước 2: Tải mã nguồn về VPS
```bash
git clone https://github.com/<tai-khoan-cua-ban>/StudyRAG.git /root/examoras-source
cd /root/examoras-source
```

### Bước 3: Chạy Script tự động cài đặt môi trường
Script này sẽ tự động cài đặt Docker, Nginx, Certbot tường lửa UFW và cấu hình Reverse Proxy cho cả 2 domain:
```bash
sudo bash deploy/scripts/setup-vps.sh
```

---

## 3. Cấu hình Biến Môi Trường (.env)

Mở file cấu hình trên VPS:
```bash
nano /opt/examoras/backend/.env
```

Điền các thông số thật của bạn:
```bash
APP_ENV=production
FRONTEND_ORIGINS=https://examoras.site,https://www.examoras.site

# SUPABASE (Dùng Session Pooler port 5432)
DATABASE_URL=postgresql://postgres.crvozuwnrnibnlweabre:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://crvozuwnrnibnlweabre.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# TENCENT CLOUD COS
S3_ENDPOINT_URL=https://cos.ap-singapore.myqcloud.com
S3_BUCKET_NAME=examoras-1467725955
S3_REGION=ap-singapore
AWS_ACCESS_KEY_ID=IKIDpTt5...
AWS_SECRET_ACCESS_KEY=...

# AI FLAGS
AI_FEATURES_ENABLED=false
```
*(Nhấn `Ctrl + O` → `Enter` để lưu, `Ctrl + X` để thoát nano).*

---

## 4. Khởi Động Docker & Kích Hoạt SSL HTTPS

### Bước 1: Khởi chạy Docker Containers
```bash
cd /opt/examoras/deploy
docker compose up -d --build
```

Kiểm tra 2 container đang chạy:
```bash
docker ps
```
*(Bạn sẽ thấy 2 container: `examoras-api` và `examoras-docker-dashboard` đang chạy).*

### Bước 2: Cấp chứng chỉ SSL HTTPS miễn phí (Certbot Let's Encrypt)
Chạy 1 lệnh duy nhất để kích hoạt HTTPS cho cả 2 tên miền:
```bash
certbot --nginx -d api.examoras.site -d backend.examoras.site
```
*(Nhập email và chọn `Y` để đồng ý).*

---

## 5. Truy Cập & Quản Trị Hệ Thống

### 🌐 1. Kiểm tra Backend API:
Truy cập trên trình duyệt: **`https://api.examoras.site/api/v1/ready`**
- Kết quả trả về JSON: `{"status":"ready","database":"connected","storage":"configured","ai_enabled":false}`.

### 🎛️ 2. Bảng điều khiển Docker (`https://backend.examoras.site`):
Truy cập: **`https://backend.examoras.site`**
- **Lần đầu tiên vào**: Hệ thống sẽ yêu cầu bạn đặt **Tên đăng nhập (Admin)** và **Mật khẩu quản trị**.
- **Các tính năng trên giao diện Portainer Dashboard**:
  - 🟢 **Containers**: Xem trực tiếp các container đang chạy, mức tiêu thụ CPU & RAM.
  - 🔄 **Restart / Stop / Start**: Nhấn nút chuột để khởi động lại API hoặc tắt/bật container.
  - 📜 **Logs Viewer**: Xem log trực tiếp của FastAPI backend theo thời gian thực (realtime) mà không cần gõ lệnh SSH.
  - 💻 **Console**: Mở terminal bash trực tiếp vào bên trong container từ trình duyệt web.
  - ⚙️ **Stacks / Compose**: Chỉnh sửa file `docker-compose.yml` trực tiếp trên web.
