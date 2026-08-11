# Triển khai backend StudyRAG V2

Tài liệu này áp dụng cho chế độ **AI tạm ngưng** (`AI_FEATURES_ENABLED=false`): backend vẫn upload, liệt kê, tải lại và xóa PDF, nhưng không chunk, không embed và `POST /api/v1/chat` trả HTTP 503. Mọi lệnh dưới đây chạy từ thư mục gốc repository, trừ khi ghi rõ khác.

## Thành phần

| File | Vai trò |
|---|---|
| `deploy/docker-compose.yml` | Service `api`, image `studyrag-api:latest`, build context `../backend` với `dockerfile: Dockerfile`, `env_file: ../backend/.env`, publish `127.0.0.1:8000:8000`, network `studyrag`, healthcheck gọi `/api/v1/health` (interval 30s, timeout 10s, retries 3, start_period 120s). |
| `deploy/nginx/studyrag.conf` | Reverse proxy `api.studyrag.bond` → `127.0.0.1:8000`, `client_max_body_size 50m`, `proxy_buffering off` cho SSE. |
| `deploy/scripts/setup-vps.sh` | Cài Docker/Nginx/UFW, copy repo vào `/opt/studyrag`, tạo `/opt/studyrag/backend/.env` từ `backend/.env.example`. |

Container publish cổng 8000 **chỉ trên loopback** của host. Truy cập công khai đi qua Nginx trên 80/443; không expose 8000 ra ngoài.

## 1. Cấu hình

Đặt trong `backend/.env` (trên VPS là `/opt/studyrag/backend/.env`, file mà `env_file` của compose nạp vào container):

```
AI_FEATURES_ENABLED=false
```

Giá trị hợp lệ: `true`, `1`, `yes`, `on` để bật; `false`, `0`, `no`, `off` để tắt (không phân biệt chữ hoa/thường). Biến vắng mặt hoặc chỉ chứa khoảng trắng được hiểu là `false`. **Giá trị ngoài hai tập này làm tiến trình backend dừng ngay lúc khởi động** kèm lỗi nêu tên biến `AI_FEATURES_ENABLED`, nên container sẽ restart liên tục thay vì âm thầm chạy sai chế độ.

Ở chế độ tắt, `DIFY_API_KEY` và `EMBEDDING_MODEL` không được sử dụng và không cần điền giá trị thật; readiness không phụ thuộc chúng. Không commit `.env`, service-role key, secret Dify/AWS hoặc PDF người dùng.

## 2. Build `Runtime_Image`

Build context là `backend/`, không phải thư mục gốc repository, nên mọi đường dẫn `COPY` trong `backend/Dockerfile` được hiểu tương đối với `backend/` và file nằm ngoài `backend/` không nhìn thấy được từ build này.

Qua Compose (đúng cách compose đã khai báo):

```sh
docker compose -f deploy/docker-compose.yml build api
```

Tương đương bằng `docker build` trực tiếp:

```sh
docker build -f backend/Dockerfile -t studyrag-api:latest backend
```

Image được cài từ `backend/requirements.txt`, file này **không còn** `numpy`, `torch`, `transformers`, `sentence-transformers`. Bốn package đó nằm ở `backend/requirements-ai.txt` và chỉ được cài khi bật lại `AI_FEATURES_ENABLED=true`.

`backend/Dockerfile` ở chế độ tắt **không** khai báo `HF_HOME`/`SENTENCE_TRANSFORMERS_HOME`, **không** tạo thư mục cache `/opt/huggingface` và **không** còn bước preload model embedding lúc build — đây là phần weight khoảng 500 MB đã được cắt khỏi image. Vì Dockerfile không còn khai báo `ARG EMBEDDING_MODEL`, build arg `EMBEDDING_MODEL` cũng đã được bỏ khỏi `deploy/docker-compose.yml`; truyền lại nó chỉ sinh cảnh báo "unknown build arg" chứ không có tác dụng. Hai lib hệ thống `libglib2.0-0` và `libgl1` **được giữ** vì PyMuPDF cần chúng, không phải vì torch.

### Gate chặn package ML trong build

Stage runtime chạy một bước kiểm tra **inline** (`RUN python -c ...`) làm build **thất bại** nếu `torch`, `transformers`, `sentence_transformers` hoặc `numpy` import được, hoặc nếu thiếu PyMuPDF (module `fitz`). Nhờ vậy một image vi phạm không bao giờ được tạo, nên cũng không thể publish (Yêu cầu 6 tiêu chí 12).

Kiểm tra được viết inline **vì build context là `../backend`**: thư mục `scripts/` ở gốc repository không nằm trong build context, nên một dòng `COPY scripts/verify_no_ml_packages.py ...` sẽ thất bại. Bản đầy đủ tương đương dùng cho CI là `scripts/verify_no_ml_packages.py`; nó kiểm tra thêm tên distribution đã cài qua `importlib.metadata` nên bắt được cả trường hợp package tới dưới dạng dependency gián tiếp. Chạy nó trong một job CI riêng, ngoài Docker:

```sh
python scripts/verify_no_ml_packages.py
```

Nếu sau này muốn dùng chính file đó trong Dockerfile, phải đổi build context sang gốc repository (`context: ..` cùng `dockerfile: backend/Dockerfile`) và sửa mọi đường dẫn `COPY` tương ứng.

## 3. Chạy container

```sh
docker compose -f deploy/docker-compose.yml up -d --build
docker compose -f deploy/docker-compose.yml logs -f api
```

Trên VPS do `setup-vps.sh` dựng, dùng `docker compose -f /opt/studyrag/deploy/docker-compose.yml up -d --build`.

Log startup phải có đúng một dòng INFO cho mỗi lần khởi động tiến trình:

```
AI features enabled: False
```

Dừng và xem trạng thái:

```sh
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml down
```

## 4. Xác minh bằng readiness endpoint

Từ chính host đang chạy container:

```sh
curl -fsS http://127.0.0.1:8000/api/v1/ready
curl -fsS http://127.0.0.1:8000/ready
```

Kỳ vọng ở chế độ tắt, khi database và S3 truy cập được — `/api/v1/ready`:

```json
{
  "status": "ready",
  "checks": {
    "database": true,
    "storage_configured": true,
    "storage_reachable": true,
    "dify_configured": false,
    "embedding_configured": false
  },
  "ai_enabled": false,
  "message": null
}
```

`/ready` ở root là probe gọn dùng chung cùng phép tính, chỉ trả hai trường:

```json
{ "status": "ready", "ai_enabled": false }
```

Hai điểm cần chú ý:

- `status` được tính **chỉ** từ `database`, `storage_configured` và `storage_reachable`. `dify_configured` và `embedding_configured` vẫn được báo trong `checks` nhưng bị loại khỏi quyết định, nên `status = ready` cùng lúc với hai trường đó bằng `false` là đúng, không phải lỗi. Khi `AI_FEATURES_ENABLED=true`, cả năm kiểm tra phải `true`.
- `GET /api/v1/health` và `GET /health` không đổi, **không** có `ai_enabled`; healthcheck của Compose trỏ vào `/api/v1/health` nên không bị ảnh hưởng bởi cờ.
- Nếu `status = not_ready`, trường `message` của `/api/v1/ready` cho biết có dependency chưa sẵn sàng; đối chiếu từng trường trong `checks` để khoanh vùng database hay S3.

Kiểm tra healthcheck của Docker:

```sh
docker inspect --format '{{json .State.Health}}' "$(docker compose -f deploy/docker-compose.yml ps -q api)"
```

## 5. Đo kích thước image (Yêu cầu 6 tiêu chí 6)

Tiêu chí này **không** được kiểm chứng bằng pytest; đây là phép đo thủ công, thực hiện một lần và ghi lại kết quả.

Điều kiện so sánh: cùng kiến trúc CPU và cùng base image (`python:3.12-slim`) cho cả hai lần build. Baseline là image build từ `backend/Dockerfile` **trước** thay đổi tắt AI; lấy nó ra bằng worktree để không chạm working tree hiện tại:

```sh
git worktree add ../studyrag-baseline <commit-truoc-thay-doi>
docker build -f ../studyrag-baseline/backend/Dockerfile -t studyrag-api:baseline ../studyrag-baseline/backend
docker image inspect studyrag-api:baseline --format '{{.Size}}'
```

Rồi build và đo image mới:

```sh
docker build -f backend/Dockerfile -t studyrag-api:ai-disabled backend
docker image inspect studyrag-api:ai-disabled --format '{{.Size}}'
```

`{{.Size}}` trả kích thước uncompressed theo byte; chia cho `1048576` để ra MiB. Ghi lại **cả hai** con số và đối chiếu hai ngưỡng:

- Tương đối: `size_moi <= 0.5 * size_baseline`.
- Tuyệt đối: `size_moi <= 800 MiB` (838.860.800 byte).

Cả hai ngưỡng phải đạt. Dọn worktree sau khi đo: `git worktree remove ../studyrag-baseline`.

## 6. Đo RSS lúc idle (Yêu cầu 6 tiêu chí 11 / NFR 1)

Cũng là phép đo thủ công, chạy trên môi trường staging. Ngưỡng: **RSS không vượt 512 MiB** (524.288 KiB) khi tiến trình ở trạng thái idle sau startup.

Khởi động container, **không gửi request nào**, đợi 60 giây kể từ khi startup hoàn tất rồi đo:

```sh
docker compose -f deploy/docker-compose.yml up -d
sleep 60
docker stats --no-stream "$(docker compose -f deploy/docker-compose.yml ps -q api)"
```

`MEM USAGE` của `docker stats` là số liệu cgroup nên có thể tính cả page cache. Con số sát RSS hơn là `VmRSS` của tiến trình uvicorn, chính là PID 1 trong container:

```sh
docker compose -f deploy/docker-compose.yml exec api \
  python -c "print([l for l in open('/proc/1/status') if l.startswith('VmRSS')][0].strip())"
```

`ps -o rss=` cho cùng thông tin nhưng `procps` không được cài trong image runtime, nên nếu muốn dùng `ps` thì chạy trên host với PID của container:

```sh
ps -o rss= -p "$(docker inspect --format '{{.State.Pid}}' "$(docker compose -f deploy/docker-compose.yml ps -q api)")"
```

Cả `ps -o rss=` và `VmRSS` trả kilobyte. Ghi lại con số đo được cùng thời điểm đo.

## 7. Hành vi đã đặc tả của `POST /api/v1/chat`

Ở chế độ tắt, endpoint chat trả về ba mã trạng thái khác nhau tùy request. Cả ba đều là hành vi đúng theo đặc tả:

| Request | Kết quả |
|---|---|
| Đã xác thực, body là JSON hợp lệ về cú pháp (kể cả sai schema `ChatRequest`, `document_id` không tồn tại hoặc `conversation_id` của người khác) | **503** với `error.code = "ai_features_disabled"` kèm thông báo tiếng Việt. Response là JSON, không phải `text/event-stream`, không có header `X-Conversation-ID`/`X-User-Message-ID`, không tạo row `conversations`/`messages`, không gọi Dify, không truy vấn `document_chunks`. |
| Thiếu bearer token, token sai định dạng hoặc đã hết hạn | **401** theo hành vi xác thực hiện có, không phải 503. Xác thực chạy trước cổng kiểm tra cờ. |
| Body **không parse được** thành JSON | **422** từ tầng validation của framework. |

Trường hợp 422 là hành vi đã được đặc tả (Yêu cầu 2 tiêu chí 9 của spec `remove-ai-features-upgrade`), **không phải bug** và không phải lỗ hổng của cổng `ai_features_disabled`: validation body của FastAPI chạy trước dependency của router. Đừng báo cáo nó như một sự cố; chỉ cần thân request là JSON hợp lệ thì cổng trả về 503 như mong đợi.

Các endpoint `/api/v1/conversations` **không** bị gán cổng: người dùng vẫn đọc và xóa hội thoại của chính mình khi AI đang tắt.

## 8. Bật lại chế độ AI

1. Đặt `AI_FEATURES_ENABLED=true` trong `backend/.env`.
2. Cài tập dependency AI tùy chọn — image phải được build lại với cả hai file requirements: `pip install -r backend/requirements.txt -r backend/requirements-ai.txt`.
3. Build lại và khởi động lại container: `docker compose -f deploy/docker-compose.yml up -d --build`.
4. Xác minh: log startup báo `AI features enabled: True`, `/api/v1/ready` trả `ai_enabled: true` và chỉ `ready` khi cả năm kiểm tra đều `true`.

Không cần thay đổi mã nguồn. Nếu cờ bật mà dependency AI chưa được cài, startup **thất bại** kèm lỗi nêu tên `backend/requirements-ai.txt` thay vì tự rơi về chế độ tắt.
