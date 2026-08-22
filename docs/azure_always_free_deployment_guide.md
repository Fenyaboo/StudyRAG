# Hướng Dẫn Triển Khai Toàn Diện Examoras Lên Microsoft Azure (Always Free 100%)

Tài liệu này hướng dẫn chi tiết cách đưa toàn bộ hệ thống **Examoras** lên hạ tầng đám mây của **Microsoft Azure** theo diện **Miễn phí Vĩnh viễn (Always Free)**:
- **Frontend (`examoras.site`)**: Chạy trên **Azure Static Web Apps (Free Plan)**.
- **Backend (`api.examoras.site`)**: Chạy trên **Azure Container Apps (Serverless Container Always Free)**.

---

## 📋 TỔNG QUAN HẠ TẦNG

```mermaid
graph TB
    subgraph Client["👤 Người dùng toàn cầu"]
        Browser["Trình duyệt (examoras.site)"]
    end

    subgraph Azure["☁️ Hạ tầng Microsoft Azure (Always Free 100%)"]
        SWA["🌐 Azure Static Web Apps (Free Plan)<br/>examoras.site & www.examoras.site<br/>(100GB Bandwidth / Tháng, SSL Auto)"]
        ACA["🚀 Azure Container Apps (Always Free)<br/>api.examoras.site<br/>(2 Triệu requests/tháng, 180k vCPU-s)"]
    end

    subgraph External["🗄️ Dữ liệu & Lưu trữ bên ngoài"]
        DB[(Supabase PostgreSQL Pooler)]
        COS[(Tencent Cloud COS - PDF Storage)]
    end

    Browser -->|HTTPS| SWA
    Browser -->|API Requests & SSE Stream| ACA
    ACA -->|Query / Vector| DB
    ACA -->|Presigned URL / Upload| COS
```

---

# 🚀 PHẦN 1: DEPLOY FRONTEND LÊN AZURE STATIC WEB APPS

### Bước 1: Tạo Static Web App trên Azure Portal
1. Truy cập: [https://portal.azure.com](https://portal.azure.com)
2. Tìm kiếm dịch vụ: **`Static Web Apps`** → Nhấn **+ Create**.
3. **Điền thông tin cơ bản:**
   - **Subscription**: Chọn gói Azure của bạn.
   - **Resource Group**: Chọn hoặc tạo mới (ví dụ: `rg-examoras`).
   - **Name**: `examoras-frontend`
   - **Plan type**: Chọn **`Free: For hobbies and personal projects`** ($0/tháng vĩnh viễn).
   - **Region**: Chọn **East Asia** (Hong Kong) hoặc **Southeast Asia** (Singapore).
4. **Kết nối GitHub:**
   - Bấm **Sign in with GitHub** → Chọn Organization: `Fenyaboo` → Repository: `StudyRAG` → Branch: `main`.
5. **Cấu hình Build:**
   - **Build Presets**: Chọn **`Custom`**
   - **App location**: Gõ `/frontend`
   - **Api location**: Để trống
   - **Output location**: Gõ `dist`
6. Nhấn **Review + create** → **Create**.

> [!TIP]
> Azure sẽ tự động thêm 1 file GitHub Actions vào repo của bạn. Mỗi khi bạn `git push`, Azure sẽ tự build và cập nhật website trong vòng 1 phút!

### Bước 2: Gắn tên miền `examoras.site`
1. Vào Static Web App vừa tạo → Chọn menu **Custom domains** ở thanh bên trái.
2. Nhấn **+ Add** → Chọn **Custom domain on other DNS**.
3. Điền `examoras.site` và làm theo hướng dẫn thêm bản ghi CNAME hoặc TXT trên Cloudflare DNS.
4. Thêm tiếp bản ghi cho `www.examoras.site`. Azure sẽ tự động cấp chứng chỉ SSL HTTPS miễn phí vĩnh viễn!

---

# ⚡ PHẦN 2: DEPLOY BACKEND LÊN AZURE CONTAINER APPS (Always Free)

*Azure Container Apps tặng miễn phí mỗi tháng: **2 triệu HTTP Requests**, **180.000 vCPU-seconds**, **360.000 GiB-seconds**.*

### Bước 1: Tạo Container App
1. Trên Azure Portal, tìm kiếm: **`Container Apps`** → Nhấn **+ Create**.
2. **Tab Basics (Cơ bản):**
   - **Resource Group**: Chọn `rg-examoras`
   - **Container App Name**: `examoras-api`
   - **Region**: **Southeast Asia** (Singapore) hoặc **East Asia**.
   - **Container Apps Environment**: Nhấn **Create new** → Đặt tên `env-examoras` → Nhấn Create.
3. **Tab Container:**
   - **Image source**: Chọn **Docker Hub or other registries**
   - **Image and tag**: `ghcr.io/fenyaboo/studyrag:latest` (hoặc image build từ Dockerfile)
   - **Container CPU and Memory**: Chọn gói nhỏ nhất **`0.25 vCPU, 0.5 GiB RAM`** *(để nằm trọn trong hạn mức miễn phí vĩnh viễn)*.
4. **Tab Ingress (Mạng vào):**
   - **Ingress**: Tích chọn **`Enabled`** (Bật).
   - **Ingress traffic**: Chọn **`Accepting traffic from anywhere`** (Công khai toàn cầu).
   - **Target Port**: Gõ **`8000`**.
5. Nhấn **Review + create** → **Create**.

---

### Bước 2: Thêm các Biến Môi Trường (.env)

Vào Container App `examoras-api` vừa tạo:
1. Ở menu bên trái, chọn **Application** → **Containers** → Nhấn **Edit and deploy**.
2. Chuyển sang tab **Environment variables** (Biến môi trường) → Thêm các biến sau:

| Tên biến | Giá trị |
|---|---|
| `APP_ENV` | `production` |
| `FRONTEND_ORIGINS` | `https://examoras.site,https://www.examoras.site` |
| `DATABASE_URL` | `postgresql://postgres.crvozuwnrnibnlweabre:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres` |
| `SUPABASE_URL` | `https://crvozuwnrnibnlweabre.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` |
| `S3_ENDPOINT_URL` | `https://cos.ap-singapore.myqcloud.com` |
| `S3_BUCKET_NAME` | `examoras-1467725955` |
| `S3_REGION` | `ap-singapore` |
| `AWS_ACCESS_KEY_ID` | `IKIDpTt5...` |
| `AWS_SECRET_ACCESS_KEY` | `...` |
| `AI_FEATURES_ENABLED` | `false` |

3. Nhấn **Save** → **Deploy**.

---

### Bước 3: Gắn Custom Domain `api.examoras.site`
1. Tại Container App, vào menu **Settings** → **Custom domains** → Nhấn **+ Add custom domain**.
2. Điền tên miền: `api.examoras.site`.
3. Azure sẽ cung cấp cho bạn 2 giá trị DNS:
   - **Bản ghi CNAME**: Trỏ `api` về `examoras-api.xxx.azurecontainerapps.io`
   - **Bản ghi TXT (để xác thực)**: `asuid.api` trỏ về mã xác thực của Azure.
4. Thêm 2 bản ghi này vào trang quản lý DNS của bạn (Cloudflare).
5. Sau khi xác thực xong, Azure sẽ tự động cấp chứng chỉ SSL Managed Certificate miễn phí cho `api.examoras.site`.

---

## 🔍 KIỂM TRA HOÀN TẤT:

- **Frontend**: Truy cập **`https://examoras.site`** → Giao diện Examoras mở ra mượt mà, tải từ mạng CDN toàn cầu của Microsoft.
- **Backend**: Truy cập **`https://api.examoras.site/api/v1/ready`** → Trả về `{"status":"ready", ...}` với chứng chỉ SSL HTTPS xanh lá!
