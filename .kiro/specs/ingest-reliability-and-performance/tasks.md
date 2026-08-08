# Kế hoạch triển khai — Ingest Reliability and Performance

## Quy ước DAG

- Mỗi node có `id` ổn định dạng `IRP-NNN`; không đổi ID khi sắp xếp hoặc cập nhật nội dung task.
- `status` ban đầu của mọi task là `pending`; chỉ chuyển trạng thái khi task được thực thi và có bằng chứng validation tương ứng.
- `dependencies` là các task phải hoàn tất trước. Danh sách rỗng (`[]`) nghĩa là có thể bắt đầu ngay.
- Các lệnh validation chạy từ thư mục gốc repository, dùng fake/local dependency và không được đọc, in hoặc ghi `.env`, credential, token hay secret.
- Các task Property 1/2 phải được viết và chạy trên code UNFIXED trước khi implementation. Property 1 được phép FAIL ở giai đoạn khám phá; Property 2 phải PASS để chốt baseline.
- Không thêm worker, queue, process model hoặc dependency hạ tầng mới. Public status kết thúc vẫn là `ready`, `failed`, `ocr_required`.

## DAG tổng quan

| ID ổn định | Ưu tiên | status | Task | dependencies | Có thể chạy song song |
|---|---:|---|---|---|---|
| `IRP-001` | P0 | `pending` | **Property 1: Bug Condition** — khám phá document_id mismatch | `[]` | Có, cùng các task khám phá `IRP-002`–`IRP-005` |
| `IRP-002` | P0 | `pending` | **Property 1: Bug Condition** — khám phá processing vô hạn/status race | `[]` | Có, cùng `IRP-001`, `IRP-003`–`IRP-005` |
| `IRP-003` | P1 | `pending` | **Property 1: Bug Condition** — khám phá cache model/tokenizer không nhất quán | `[]` | Có, cùng các task khám phá khác |
| `IRP-004` | P1 | `pending` | **Property 1: Bug Condition** — khám phá chunking tokenize lặp | `[]` | Có, cùng các task khám phá khác |
| `IRP-005` | P1 | `pending` | **Property 1: Bug Condition** — khám phá readiness S3 báo sai/burst request | `[]` | Có, cùng các task khám phá khác |
| `IRP-006` | P0 | `pending` | **Property 2: Preservation** — baseline document create/owner/cleanup | `[IRP-001]` | Có, cùng `IRP-007`–`IRP-010` |
| `IRP-007` | P0 | `pending` | **Property 2: Preservation** — baseline state/API/health behavior | `[IRP-002]` | Có, cùng `IRP-006`, `IRP-008`–`IRP-010` |
| `IRP-008` | P1 | `pending` | **Property 2: Preservation** — baseline model loading/cache contract | `[IRP-003]` | Có, cùng các task preservation khác |
| `IRP-009` | P1 | `pending` | **Property 2: Preservation** — baseline chunk metadata/id contract | `[IRP-004]` | Có, cùng các task preservation khác |
| `IRP-010` | P1 | `pending` | **Property 2: Preservation** — baseline readiness/liveness contract | `[IRP-005]` | Có, cùng các task preservation khác |
| `IRP-011` | P0 | `pending` | Sửa document_id mismatch trong create/ingest | `[IRP-001, IRP-006]` | Không với `IRP-012`; có thể song song với P1 nếu tách file, nhưng merge wiring phải nối tiếp |
| `IRP-012` | P0 | `pending` | Bounded status transition, timeout và recovery | `[IRP-002, IRP-007, IRP-011]` | Không; dùng chung repository/orchestration với `IRP-011` |
| `IRP-013` | P1 | `pending` | Canonical model/tokenizer cache và Docker layer reuse | `[IRP-003, IRP-008, IRP-012]` | Không với task sửa P0 do dùng chung `main.py`/config; sau đó mở interface cho `IRP-014`, `IRP-015` |
| `IRP-014` | P1 | `pending` | Chunker linear tokenization và giữ data contract | `[IRP-004, IRP-009, IRP-013]` | Có thể song song với `IRP-015` sau `IRP-013` nếu không cùng sửa file wiring |
| `IRP-015` | P1 | `pending` | Readiness S3 thật với TTL/single-flight, giữ healthcheck | `[IRP-005, IRP-010, IRP-012, IRP-013]` | Có thể song song với `IRP-014`; các thay đổi chung ở `main.py`/config phải được serialize |
| `IRP-016` | P2 | `pending` | Integration/regression, lint/test/build và deploy smoke checklist | `[IRP-011, IRP-012, IRP-013, IRP-014, IRP-015]` | Không; là gate tích hợp cuối |
| `IRP-017` | P2 | `pending` | Checkpoint phát hành và xác nhận toàn bộ DAG | `[IRP-016]` | Không |

## Chi tiết task

### IRP-001 — **Property 1: Bug Condition** - Khám phá document_id mismatch

- **Priority:** P0
- **Status:** `pending`
- **Dependencies:** `[]`
- **Có thể chạy song song:** Có, dùng file test riêng với `IRP-002`–`IRP-005`.
- **Mục tiêu:** Viết exploratory property test trước khi sửa để tái hiện trường hợp route/task dùng ID `A` nhưng `DocumentRepository.create` để database sinh ID `B`, từ đó chặn lỗi production `Document does not belong to owner` bằng counterexample cụ thể.
- **File dự kiến:**
  - `backend/tests/test_irp_identity_exploration.py` (mới).
  - `backend/tests/fakes.py` hoặc fixture repository hiện có (chỉ bổ sung fake nếu cần).
  - Đọc các điểm tích hợp `backend/app/api/v1/documents.py` và `backend/app/db/repositories/document_repo.py`; chưa sửa implementation ở task này.
- **Acceptance / validation:**
  1. Test mô hình hóa `isBugCondition(X)` khi `persisted_document_id != scheduled_document_id` và giữ cặp `(owner_id, document_id)`.
  2. Chạy trên UNFIXED code phải tạo được counterexample reproducible, ví dụ row lưu `B` nhưng background ingest truy vấn `A` và ownership check thất bại.
  3. Ghi rõ counterexample và expected behavior trong test output/task result; không sửa test để che failure.
  4. Test không cần database, S3 hoặc credential production.
- **Lệnh validation:**
  ```bash
  python -m pytest backend/tests/test_irp_identity_exploration.py -q
  ```
  **Kết quả mong đợi trước fix:** FAIL vì ID persisted và scheduled không giống nhau.
- **Requirements:** `_Requirements: 2.1.1, 2.1.2, 2.1.3, 2.1.4, 3.3_`

### IRP-002 — **Property 1: Bug Condition** - Khám phá processing vô hạn và status race

- **Priority:** P0
- **Status:** `pending`
- **Dependencies:** `[]`
- **Có thể chạy song song:** Có, dùng file test riêng với các task khám phá khác.
- **Mục tiêu:** Surface counterexamples cho timeout/cancellation/restart, stale row, row `NULL`, bounded status retry và task cũ ghi đè terminal state. Đây là test khám phá, không phải nơi triển khai guard.
- **File dự kiến:**
  - `backend/tests/test_irp_state_exploration.py` (mới).
  - Fake repository/task fixture trong `backend/tests/fakes.py` nếu cần.
  - Điểm tích hợp được kiểm tra: `backend/app/api/v1/documents.py`, `backend/app/db/repositories/document_repo.py`, `backend/app/main.py`.
- **Acceptance / validation:**
  1. Sinh hoặc mô phỏng document `processing` quá deadline, `encode` vượt timeout, task bị cancel/restart và hai task cập nhật cùng document.
  2. Bao gồm row `status/page_count/chunk_count` là `NULL` và xác nhận behavior hiện tại được ghi nhận.
  3. Chạy UNFIXED và ghi ít nhất một counterexample cho trạng thái kẹt, update race hoặc retry không bounded; nếu một case đã pass thì ghi nhận case đó và tiếp tục kiểm tra các case còn lại.
  4. Không dùng retry vô hạn trong chính test.
- **Lệnh validation:**
  ```bash
  python -m pytest backend/tests/test_irp_state_exploration.py -q
  ```
  **Kết quả mong đợi trước fix:** FAIL ở các assertion về terminal state hữu hạn/không ghi đè.
- **Requirements:** `_Requirements: 2.2.1, 2.2.2, 2.2.3, 2.2.4, 2.2.5, 2.2.6, 3.2, 3.7_`

### IRP-003 — **Property 1: Bug Condition** - Khám phá cache model/tokenizer không nhất quán

- **Priority:** P1
- **Status:** `pending`
- **Dependencies:** `[]`
- **Có thể chạy song song:** Có, độc lập với các exploratory test khác.
- **Mục tiêu:** Chứng minh build/runtime dùng khác model id, cache root hoặc layout; kiểm tra offline runtime không được âm thầm fallback sang root thứ hai hay tải lại ngoài dự kiến.
- **File dự kiến:**
  - `backend/tests/test_irp_model_cache_exploration.py` (mới).
  - Fixture config/model giả, không dùng model download thật.
  - Điểm tích hợp được kiểm tra: `backend/app/core/config.py`, `backend/app/services/embedding.py`, `backend/Dockerfile`.
- **Acceptance / validation:**
  1. Test các trường hợp `build_cache_root != runtime_cache_root`, model id mismatch, missing cache và hai layout `/opt/huggingface/...`.
  2. Chạy offline fixture trên UNFIXED và ghi nhận runtime lookup sai, load lặp hoặc lỗi không quan sát được.
  3. Không in giá trị môi trường nhạy cảm; model id dùng trong test phải là giá trị không bí mật.
- **Lệnh validation:**
  ```bash
  python -m pytest backend/tests/test_irp_model_cache_exploration.py -q
  ```
  **Kết quả mong đợi trước fix:** FAIL ở assertion canonical root/model id và missing-cache error rõ ràng.
- **Requirements:** `_Requirements: 2.3.1, 2.3.2, 2.3.3, 2.3.4, 3.1, 3.3_`

### IRP-004 — **Property 1: Bug Condition** - Khám phá chunker tokenize lặp và phá hợp đồng

- **Priority:** P1
- **Status:** `pending`
- **Dependencies:** `[]`
- **Có thể chạy song song:** Có, dùng tokenizer spy và file test riêng.
- **Mục tiêu:** Surface counterexamples cho tokenize lại theo cửa sổ, chi phí không tuyến tính, chunk vượt `220`, overlap sai, mất metadata/id hoặc không kết thúc với empty/Unicode/long-token input.
- **File dự kiến:**
  - `backend/tests/test_irp_chunker_exploration.py` (mới).
  - Tokenizer spy/fake trong `backend/tests/fakes.py` nếu cần.
  - Điểm tích hợp được kiểm tra: `backend/app/services/chunker.py`.
- **Acceptance / validation:**
  1. Property test sinh page ngắn/dài, Unicode, input rỗng và token đơn lẻ dài; đếm số lần tokenizer được gọi.
  2. Có counterexample UNFIXED cho ít nhất một lỗi thuộc bug condition; ghi input tối giản, số token, số lần gọi và output metadata/id.
  3. Test giữ constants từ thiết kế: `max_tokens=220`, `overlap=32`, stride `188` khi dữ liệu đủ dài.
- **Lệnh validation:**
  ```bash
  python -m pytest backend/tests/test_irp_chunker_exploration.py -q
  ```
  **Kết quả mong đợi trước fix:** FAIL ở assertion linear/tokenize một lần hoặc data contract của chunk.
- **Requirements:** `_Requirements: 2.4.1, 2.4.2, 2.4.3, 2.4.4, 2.4.5, 3.1_`

### IRP-005 — **Property 1: Bug Condition** - Khám phá readiness S3 sai và burst request

- **Priority:** P1
- **Status:** `pending`
- **Dependencies:** `[]`
- **Có thể chạy song song:** Có, dùng fake S3 và file test riêng.
- **Mục tiêu:** Chứng minh bucket string truthy không đủ để báo ready và xác định behavior khi `head_bucket` fail/raise hoặc nhiều request cùng lúc lúc TTL hết hạn.
- **File dự kiến:**
  - `backend/tests/test_irp_readiness_exploration.py` (mới).
  - Fake `StorageService`/S3 trong `backend/tests/fakes.py` nếu cần.
  - Điểm tích hợp được kiểm tra: `backend/app/services/storage.py`, `backend/app/api/v1/system.py`, `backend/deploy/docker-compose.yml`.
- **Acceptance / validation:**
  1. Mock bucket có giá trị nhưng `head_bucket` thất bại và xác nhận UNFIXED có thể báo ready sai.
  2. Gọi readiness liên tiếp và đồng thời, đo số lần S3 call khi cache hiện tại hết hạn; ghi counterexample burst nếu có.
  3. Kiểm tra riêng health endpoint hiện tại không bị biến thành dependency của S3.
- **Lệnh validation:**
  ```bash
  python -m pytest backend/tests/test_irp_readiness_exploration.py -q
  ```
  **Kết quả mong đợi trước fix:** FAIL ở assertion `ready == real_s3_check` hoặc giới hạn số request.
- **Requirements:** `_Requirements: 2.5.1, 2.5.2, 2.5.3, 2.5.4, 2.5.5, 3.1_`

### IRP-006 — **Property 2: Preservation** - Baseline document create/owner/cleanup

- **Priority:** P0
- **Status:** `pending`
- **Dependencies:** `[IRP-001]`
- **Có thể chạy song song:** Có với `IRP-007`–`IRP-010` sau khi exploratory identity test đã ghi nhận baseline.
- **Mục tiêu:** Theo observation-first methodology, ghi và khóa các hành vi không thuộc bug condition: owner isolation, duplicate detection, storage key, cleanup khi DB insert lỗi và response ingest hợp lệ.
- **File dự kiến:**
  - `backend/tests/test_irp_identity_preservation.py` (mới).
  - Các fixture hiện có trong `backend/tests/test_documents_ingest.py`, `backend/tests/test_repositories.py` chỉ được tái sử dụng hoặc mở rộng.
- **Acceptance / validation:**
  1. Chạy trên UNFIXED và PASS với document ID đã đồng nhất, owner hợp lệ, duplicate cùng `(owner_id, file_hash)` và cleanup khi create thất bại.
  2. Ghi observable baseline: status/response, storage key theo owner/document và không lộ row của owner khác.
  3. Property không yêu cầu behavior mới của bug condition và không dùng secret thật.
- **Lệnh validation:**
  ```bash
  python -m pytest backend/tests/test_irp_identity_preservation.py -q
  ```
  **Kết quả mong đợi trước fix:** PASS.
- **Requirements:** `_Requirements: 2.6.1, 2.6.2, 2.6.3, 3.4, 3.5_`

### IRP-007 — **Property 2: Preservation** - Baseline state/API/health behavior

- **Priority:** P0
- **Status:** `pending`
- **Dependencies:** `[IRP-002]`
- **Có thể chạy song song:** Có với các preservation task khác.
- **Mục tiêu:** Chốt behavior đang đúng cho ingest thành công, `ocr_required`, response status/schema, owner scoping, `/health` và các path không bị lỗi trước khi thêm transition guard/recovery.
- **File dự kiến:**
  - `backend/tests/test_irp_state_preservation.py` (mới).
  - `backend/tests/test_app_routes.py`, `backend/tests/test_documents_ingest.py` nếu cần bổ sung assertion baseline.
- **Acceptance / validation:**
  1. UNFIXED test PASS cho terminal statuses hiện có và API route/method/schema hợp lệ.
  2. Xác nhận status public không đổi khỏi `processing`, `ready`, `failed`, `ocr_required`.
  3. Xác nhận owner sai không đọc/sửa được document và liveness không phụ thuộc S3/model.
- **Lệnh validation:**
  ```bash
  python -m pytest backend/tests/test_irp_state_preservation.py backend/tests/test_app_routes.py -q
  ```
  **Kết quả mong đợi trước fix:** PASS.
- **Requirements:** `_Requirements: 2.6.1, 2.6.2, 2.6.5, 3.4, 3.5, 3.6_`

### IRP-008 — **Property 2: Preservation** - Baseline model loading/cache contract

- **Priority:** P1
- **Status:** `pending`
- **Dependencies:** `[IRP-003]`
- **Có thể chạy song song:** Có với `IRP-006`, `IRP-007`, `IRP-009`, `IRP-010`.
- **Mục tiêu:** Quan sát behavior đúng của model/tokenizer khi config hợp lệ: dimension check, lazy load/local fake load, batch behavior và không thay đổi public embedding contract.
- **File dự kiến:**
  - `backend/tests/test_irp_model_cache_preservation.py` (mới).
  - `backend/tests/test_evaluate.py` hoặc test embedding hiện có nếu cần tái sử dụng fake.
- **Acceptance / validation:**
  1. UNFIXED test PASS với một model id/cache fixture hợp lệ và cùng provider behavior hiện có.
  2. Ghi baseline số lần load, shape/dimension và kết quả embedding observable; không cần network/model thật.
  3. Không cho test đọc `.env` hoặc in cấu hình nhạy cảm.
- **Lệnh validation:**
  ```bash
  python -m pytest backend/tests/test_irp_model_cache_preservation.py -q
  ```
  **Kết quả mong đợi trước fix:** PASS.
- **Requirements:** `_Requirements: 2.6.4, 3.3, 3.6_`

### IRP-009 — **Property 2: Preservation** - Baseline chunk metadata/id contract

- **Priority:** P1
- **Status:** `pending`
- **Dependencies:** `[IRP-004]`
- **Có thể chạy song song:** Có với preservation task của các nhóm khác.
- **Mục tiêu:** Chốt observable behavior đang đúng cho input ngắn/hợp lệ: `max_tokens=220`, overlap hiện có khi áp dụng được, metadata nguồn, stable id và Unicode.
- **File dự kiến:**
  - `backend/tests/test_irp_chunker_preservation.py` (mới).
  - `backend/tests/test_chunker.py` để dùng lại fixture/assertion hiện có.
- **Acceptance / validation:**
  1. UNFIXED test PASS cho page ngắn, text Unicode, metadata page/source/document type và id deterministic.
  2. Chụp baseline với cùng document/input chạy hai lần; id phải ổn định và duy nhất trong document.
  3. Không biến exploratory failure thành baseline expectation; chỉ ghi behavior của input không thuộc bug condition.
- **Lệnh validation:**
  ```bash
  python -m pytest backend/tests/test_irp_chunker_preservation.py backend/tests/test_chunker.py -q
  ```
  **Kết quả mong đợi trước fix:** PASS.
- **Requirements:** `_Requirements: 2.4.2, 2.4.3, 2.4.4, 2.4.5, 3.8_`

### IRP-010 — **Property 2: Preservation** - Baseline readiness/liveness contract

- **Priority:** P1
- **Status:** `pending`
- **Dependencies:** `[IRP-005]`
- **Có thể chạy song song:** Có với các preservation task khác.
- **Mục tiêu:** Chốt behavior không bị thay đổi: S3 healthy cho readiness, response field `storage_configured` nếu đã tồn tại, `/health` nhẹ và Compose healthcheck tiếp tục gọi `/api/v1/health`.
- **File dự kiến:**
  - `backend/tests/test_irp_readiness_preservation.py` (mới).
  - `backend/tests/test_app_routes.py` và `deploy/docker-compose.yml` để kiểm tra contract/healthcheck.
- **Acceptance / validation:**
  1. UNFIXED test PASS với fake S3 healthy và response readiness hiện có.
  2. `/health` PASS khi S3 không được gọi; healthcheck Compose vẫn trỏ vào endpoint liveness hiện có.
  3. Ghi baseline không bao gồm secret hoặc response chứa credential.
- **Lệnh validation:**
  ```bash
  python -m pytest backend/tests/test_irp_readiness_preservation.py backend/tests/test_app_routes.py -q
  ```
  **Kết quả mong đợi trước fix:** PASS.
- **Requirements:** `_Requirements: 2.5.5, 2.6.2, 2.6.5, 3.5_`

### IRP-011 — Sửa document_id mismatch trong DocumentRepository.create/ingest

- **Priority:** P0
- **Status:** `pending`
- **Dependencies:** `[IRP-001, IRP-006]`
- **Có thể chạy song song:** Không với `IRP-012` vì cùng chạm repository/orchestration. Có thể triển khai tách biệt với P1 sau khi thống nhất không sửa cùng file wiring.
- **Mục tiêu:** Dùng một UUID duy nhất xuyên suốt request upload, storage key, DB row, background task, status và recovery; loại bỏ production failure do DB tự sinh ID khác.
- **File dự kiến:**
  - `backend/app/api/v1/documents.py`.
  - `backend/app/db/repositories/document_repo.py`.
  - Có thể cập nhật `backend/app/db/repositories/chunk_repo.py` nếu đường ingest cần ownership guard đồng bộ.
  - Hoàn thiện các test từ `backend/tests/test_irp_identity_exploration.py`, `backend/tests/test_irp_identity_preservation.py`, `backend/tests/test_documents_ingest.py`, `backend/tests/test_repositories.py`.
- **Acceptance / validation:**
  1. Sinh/xác định `document_id` đúng một lần trước DB create và background scheduling; `DocumentRepository.create` nhận/lưu explicit ID, không để default DB tạo ID khác.
  2. Background nhận đúng ID/owner/storage key từ row, không tự sinh/suy ra ID mới; task chỉ được schedule sau khi upload và row hợp lệ.
  3. DB create hoặc task initialization lỗi không để job mồ côi, row/cleanup ở trạng thái có thể quan sát và không tham chiếu ID lệch.
  4. Giữ owner scoping, storage key, duplicate detection, `202 Accepted` và schema response hiện có.
  5. Chạy lại cùng exploratory test theo **Property 1: Expected Behavior** và xác nhận PASS; chạy lại preservation test theo **Property 2: Preservation** và xác nhận PASS.
- **Lệnh validation:**
  ```bash
  python -m pytest backend/tests/test_irp_identity_exploration.py backend/tests/test_irp_identity_preservation.py backend/tests/test_documents_ingest.py backend/tests/test_repositories.py -q
  python -m ruff check backend/app/api/v1/documents.py backend/app/db/repositories/document_repo.py backend/tests
  ```
- **Requirements:** `_Bug_Condition: isBugCondition(X) với persisted_document_id != scheduled_document_id._`
  `_Expected_Behavior: expectedBehavior(X, result) yêu cầu hai ID bằng nhau, cùng owner và không có orphan job._`
  `_Preservation: Preservation Requirements về owner isolation, API contract, cleanup._`
  `_Requirements: 2.1.1, 2.1.2, 2.1.3, 2.1.4, 2.6.1, 2.6.2, 3.3, 3.4, 3.5_`

### IRP-012 — Bounded status transition, update guard, timeout và recovery

- **Priority:** P0
- **Status:** `pending`
- **Dependencies:** `[IRP-002, IRP-007, IRP-011]`
- **Có thể chạy song song:** Không với `IRP-011`; sau khi hoàn tất có thể mở các P1 theo dependency.
- **Mục tiêu:** Bảo đảm mọi ingest có đường kết thúc hữu hạn, không để `processing` vô hạn, không cho task cũ ghi đè terminal state và có recovery an toàn cho stale/legacy row.
- **File dự kiến:**
  - `backend/app/db/repositories/document_repo.py`.
  - `backend/app/db/repositories/chunk_repo.py`.
  - `backend/app/api/v1/documents.py` hoặc `backend/app/services/ingest.py` (mới nếu tách orchestration).
  - `backend/app/main.py`, `backend/app/core/config.py`.
  - `backend/tests/test_irp_state_exploration.py`, `backend/tests/test_irp_state_preservation.py` và test ingest/repository liên quan.
- **Acceptance / validation:**
  1. Timeout bao trùm chờ slot và parse/chunk/embed/persist; timeout, exception và cancellation đều chuyển `processing` sang `failed` an toàn.
  2. Transition terminal có điều kiện `owner_id`, `document_id`, `status='processing'`; task stale không ghi đè `ready`/`failed`/`ocr_required` của task khác.
  3. Recovery startup xử lý row stale và normalize `NULL` theo policy hữu hạn; không retry toàn pipeline vô hạn; status update retry có giới hạn/backoff ngắn.
  4. `ocr_required` là terminal hợp lệ; API chỉ dùng public error status `failed`; query đọc dùng fallback để không hỏng vì legacy `NULL`.
  5. Log/metric có event, document/correlation ID, transition và error code đã redacted; không có secret/PDF/embedding.
  6. Chạy lại exploratory **Property 1: Expected Behavior** và preservation **Property 2: Preservation**; cả hai phải PASS sau fix.
- **Lệnh validation:**
  ```bash
  python -m pytest backend/tests/test_irp_state_exploration.py backend/tests/test_irp_state_preservation.py backend/tests/test_documents_ingest.py backend/tests/test_repositories.py -q
  python -m ruff check backend/app/api/v1/documents.py backend/app/services backend/app/db/repositories backend/app/main.py backend/tests
  ```
- **Requirements:** `_Bug_Condition: processing quá deadline/bị gián đoạn mà không có terminal transition hoặc có conflicting write._`  
  `_Expected_Behavior: final_status thuộc {ready, failed, ocr_required}, update owner-scoped, retry bounded, lỗi an toàn._`  
  `_Preservation: giữ API/status literal, owner scope, health/liveness và resource budget._`  
  `_Requirements: 2.2.1, 2.2.2, 2.2.3, 2.2.4, 2.2.5, 2.2.6, 2.6.1, 2.6.2, 2.6.3, 2.6.4, 2.6.5, 3.2, 3.4, 3.5, 3.6, 3.7_`

### IRP-013 — Canonical model/tokenizer cache và Docker layer/cache reuse

- **Priority:** P1
- **Status:** `pending`
- **Dependencies:** `[IRP-003, IRP-008, IRP-012]`
- **Có thể chạy song song:** Không với P0 do dùng chung lifecycle/config; sau task này `IRP-014` và `IRP-015` có thể tách nhánh logic.
- **Mục tiêu:** Có một `ModelRuntime`/provider dùng chung, canonical root `/opt/huggingface`, cùng model id giữa build/runtime và Docker layer order cho phép reuse cache mà không tạo layout thứ hai.
- **File dự kiến:**
  - `backend/app/services/model_runtime.py` (mới).
  - `backend/app/services/embedding.py`.
  - `backend/app/core/config.py`, `backend/app/main.py`.
  - `backend/Dockerfile`, `deploy/docker-compose.yml`.
  - `backend/tests/test_irp_model_cache_exploration.py`, `backend/tests/test_irp_model_cache_preservation.py` và test provider mới.
- **Acceptance / validation:**
  1. `HF_HOME`, `SENTENCE_TRANSFORMERS_HOME`, `MODEL_CACHE_DIR` cùng trỏ canonical root; build/runtime dùng cùng `EMBEDDING_MODEL` và fail fast nếu mismatch.
  2. Provider singleton/lazy-load có lock, inject cùng tokenizer/model cho chunker/embedding; offline runtime dùng local-files-only, missing/mismatch cache tạo lỗi quan sát được.
  3. Dockerfile đặt layer ít thay đổi (requirements và model cache theo model id) trước source layer để sửa source không tải model lại; không tạo `/opt/huggingface` root thứ hai.
  4. Không thêm bản sao model, worker hoặc queue; giữ memory budget EC2 2 GiB.
  5. Rerun Property 1 và Property 2 của cache; cả hai PASS với fixture không network.
- **Lệnh validation:**
  ```bash
  python -m pytest backend/tests/test_irp_model_cache_exploration.py backend/tests/test_irp_model_cache_preservation.py -q
  python -m ruff check backend/app/core/config.py backend/app/main.py backend/app/services/embedding.py backend/app/services/model_runtime.py backend/tests
  docker build --progress=plain --build-arg EMBEDDING_MODEL=<model-id-khong-bi-mat> -t irp-cache:test -f backend/Dockerfile backend
  docker build --progress=plain --build-arg EMBEDDING_MODEL=<model-id-khong-bi-mat> -t irp-cache:test -f backend/Dockerfile backend
  ```
  Lần build thứ hai phải reuse các layer dependency/model phù hợp; không dùng lệnh in toàn bộ environment hoặc secret.
- **Requirements:** `_Bug_Condition: build/runtime khác cache root/model id hoặc runtime tải ngoài canonical root._`  
  `_Expected_Behavior: resolved model/cache đúng cấu hình, missing cache observable, không duplicate root._`  
  `_Preservation: giữ embedding contract, lazy/local test behavior và resource budget._`  
  `_Requirements: 2.3.1, 2.3.2, 2.3.3, 2.3.4, 2.6.4, 3.1, 3.3, 3.6_`

### IRP-014 — Chunker linear tokenization và giữ data contract

- **Priority:** P1
- **Status:** `pending`
- **Dependencies:** `[IRP-004, IRP-009, IRP-013]`
- **Có thể chạy song song:** Có với `IRP-015` sau `IRP-013` nếu không cùng chỉnh `main.py`/config; test merge phải chạy lại ở `IRP-016`.
- **Mục tiêu:** Tokenize mỗi page/đơn vị đúng một lần, cắt cửa sổ token tuyến tính với `max_tokens=220`, `overlap=32` (stride `188`), đồng thời giữ metadata và stable id.
- **File dự kiến:**
  - `backend/app/services/chunker.py`.
  - Có thể cập nhật interface injection trong `backend/app/services/model_runtime.py` nếu cần, không tạo provider thứ hai.
  - `backend/tests/test_irp_chunker_exploration.py`, `backend/tests/test_irp_chunker_preservation.py`, `backend/tests/test_chunker.py`.
- **Acceptance / validation:**
  1. Tokenizer được gọi một lần cho mỗi page; window/decoder hoạt động trên token IDs đã có, không tokenize lại từng window.
  2. Mọi chunk `<=220` token; chunks đủ dài có overlap 32 token; đoạn cuối/đầu vào ngắn được xử lý hữu hạn.
  3. Empty, Unicode và long-token input kết thúc không loop; metadata `page`, source/document type, range và token count được giữ/merge.
  4. ID deterministic từ document/page/index/content, stable khi rerun cùng input và unique trong document.
  5. Property test sinh độ dài token tăng dần chứng minh số lần tokenize cố định theo page và chi phí cắt tăng tuyến tính với window constants; rerun exploratory/preservation đều PASS.
- **Lệnh validation:**
  ```bash
  python -m pytest backend/tests/test_irp_chunker_exploration.py backend/tests/test_irp_chunker_preservation.py backend/tests/test_chunker.py -q
  python -m ruff check backend/app/services/chunker.py backend/tests
  ```
- **Requirements:** `_Bug_Condition: tokenization_repeated, chunk > 220, overlap/metadata/id sai hoặc không terminate._`  
  `_Expected_Behavior: terminate, <=220, overlap 32 khi có thể, metadata/id giữ nguyên, complexity tuyến tính._`  
  `_Preservation: giữ contract chunk hiện có cho input hợp lệ._`  
  `_Requirements: 2.4.1, 2.4.2, 2.4.3, 2.4.4, 2.4.5, 3.1, 3.3, 3.8_`

### IRP-015 — Readiness S3 thật với TTL/single-flight, giữ healthcheck

- **Priority:** P1
- **Status:** `pending`
- **Dependencies:** `[IRP-005, IRP-010, IRP-012, IRP-013]`
- **Có thể chạy song song:** Có với `IRP-014` sau `IRP-013`; nếu cả hai sửa wiring chung thì phải serialize phần `main.py`/config.
- **Mục tiêu:** `/ready` chỉ ready khi S3 thực sự truy cập được, cache cả success/failure bằng TTL bounded và lock single-flight; `/health` cùng healthcheck Compose tiếp tục là liveness nhẹ.
- **File dự kiến:**
  - `backend/app/services/storage.py`.
  - `backend/app/api/v1/system.py`, `backend/app/schemas/system.py`.
  - `backend/app/core/config.py`, `backend/app/main.py` nếu cần inject readiness cache.
  - `deploy/docker-compose.yml` (chỉ xác nhận hoặc chỉnh tối thiểu để healthcheck vẫn gọi `/api/v1/health`).
  - `backend/tests/test_irp_readiness_exploration.py`, `backend/tests/test_irp_readiness_preservation.py`, `backend/tests/test_app_routes.py`.
- **Acceptance / validation:**
  1. `StorageService.check()` thực hiện `head_bucket` thật qua client hiện có; bucket thiếu, credentials/quyền sai hoặc exception đều là not ready, không suy diễn từ `bool(bucket)`.
  2. `check_cached()` dùng monotonic time, cache true và false, TTL hữu hạn mặc định khoảng 30 giây và được validate trong khoảng an toàn; hết TTL bắt buộc refresh.
  3. Lock/single-flight bảo đảm nhiều request cùng lúc chỉ tạo một S3 call cho mỗi cửa sổ TTL; lỗi cached không gây retry burst.
  4. `/api/v1/ready` và root `/ready` dùng kết quả thật; `storage_configured` được giữ, `storage_reachable` phản ánh accessibility; `/health` không gọi S3.
  5. `deploy/docker-compose.yml` vẫn healthcheck `/api/v1/health`, không đổi liveness thành readiness.
  6. Rerun Property 1 và Property 2 readiness đều PASS với fake S3 và không dùng AWS thật.
- **Lệnh validation:**
  ```bash
  python -m pytest backend/tests/test_irp_readiness_exploration.py backend/tests/test_irp_readiness_preservation.py backend/tests/test_app_routes.py -q
  python -m ruff check backend/app/services/storage.py backend/app/api/v1/system.py backend/app/schemas/system.py backend/tests
  ```
- **Requirements:** `_Bug_Condition: reported_ready nhưng real_s3_check thất bại hoặc mọi polling đều gọi S3._`  
  `_Expected_Behavior: ready chỉ khi DB/dependencies/S3 check thành công; S3 calls single-flight và TTL bounded._`  
  `_Preservation: `/health` và Compose healthcheck giữ mục tiêu liveness._`  
  `_Requirements: 2.5.1, 2.5.2, 2.5.3, 2.5.4, 2.5.5, 2.6.2, 2.6.5, 3.1, 3.5, 3.8_`

### IRP-016 — Integration/regression, lint/test/build và deploy smoke checklist

- **Priority:** P2
- **Status:** `pending`
- **Dependencies:** `[IRP-011, IRP-012, IRP-013, IRP-014, IRP-015]`
- **Có thể chạy song song:** Không; đây là task tích hợp sau toàn bộ implementation. Các test độc lập có thể được chia runner sau khi contract merge ổn định.
- **Mục tiêu:** Xác nhận sáu nhóm sửa hoạt động cùng nhau, không hồi quy API/isolation/resource, và lập checklist smoke deploy không cần đọc hoặc in secret.
- **File dự kiến:**
  - `backend/tests/test_irp_integration_ingest.py` (mới).
  - `backend/tests/test_irp_regression_contracts.py` (mới).
  - `backend/tests/test_app_routes.py`, `backend/tests/test_documents_ingest.py`, `backend/tests/test_repositories.py`, `backend/tests/test_chunker.py` nếu cần cập nhật regression assertion.
  - `backend/Dockerfile`, `deploy/docker-compose.yml` chỉ được kiểm tra/chỉnh theo acceptance; không tạo file chứa secrets.
  - Deploy smoke checklist thực hiện trong task/CI artifact, không cần tạo spec file mới.
- **Acceptance / validation:**
  1. Integration fake end-to-end: upload tạo đúng row, background dùng đúng ID/owner, chunks persist transactional và terminal status đúng.
  2. Recovery/restart: stale/NULL row được sửa hữu hạn; task cũ không ghi đè terminal; owner A/B không nhìn hoặc sửa dữ liệu của nhau.
  3. Readiness matrix: S3 healthy/unhealthy và dependency config khác nhau; `/ready` phản ánh đúng còn `/health`/Compose healthcheck vẫn liveness.
  4. Offline cache fixture load canonical model/tokenizer, mismatch/missing cache fail rõ, không tạo root thứ hai; chunk property giữ `220/32/metadata/id`.
  5. Regression giữ route/method/schema, `202`, public statuses, storage key/duplicate/cleanup và không log secret.
  6. Hoàn tất lint, backend test, compile/build và Docker cache reuse trước smoke.
- **Lệnh validation:**
  ```bash
  python -m pytest backend/tests/test_irp_integration_ingest.py backend/tests/test_irp_regression_contracts.py -q
  python -m pytest backend/tests -q
  python -m ruff check backend/app backend/tests
  python -m compileall backend/app
  npm --prefix frontend run build
  docker build --progress=plain --build-arg EMBEDDING_MODEL=<model-id-khong-bi-mat> -t irp-final:test -f backend/Dockerfile backend
  ```
  Smoke sau khi deploy vào môi trường đã được cấp quyền, không in config/secret:
  ```bash
  curl -fsS http://127.0.0.1:<port>/api/v1/health
  curl -fsS -i http://127.0.0.1:<port>/api/v1/ready
  docker inspect --format='{{json .State.Health}}' <container>
  docker stats --no-stream <container>
  ```
- **Deploy smoke checklist:** healthcheck gọi đúng `/api/v1/health`; `/api/v1/ready` phản ánh S3 thật; tạo PDF nhỏ thấy event `created -> started -> completed`; thử timeout có kiểm soát thấy `failed`/recovery; theo dõi status-update-miss, timeout/recovery, số S3 call trong TTL, RSS và active ingest; xác nhận log đã redacted.
- **Requirements:** `_Requirements: 2.1.1–2.1.4, 2.2.1–2.2.6, 2.3.1–2.3.4, 2.4.1–2.4.5, 2.5.1–2.5.5, 2.6.1–2.6.5, 3.1–3.8_`

### IRP-017 — Checkpoint phát hành và xác nhận toàn bộ DAG

- **Priority:** P2
- **Status:** `pending`
- **Dependencies:** `[IRP-016]`
- **Có thể chạy song song:** Không; chỉ chạy sau khi integration/regression và smoke hoàn tất.
- **Mục tiêu:** Đóng task khi toàn bộ acceptance criteria có bằng chứng, không còn task implementation chưa xác nhận và deployment không làm suy giảm health/liveness hoặc memory budget.
- **File dự kiến:**
  - Không tạo file code/spec mới.
  - Kết quả là test/CI logs, Docker build output đã redacted và checklist release của task `IRP-016`.
- **Acceptance / validation:**
  1. Tất cả node `IRP-001`–`IRP-016` đã hoàn tất theo đúng dependency; các task Property 1 sau fix PASS và Property 2 vẫn PASS.
  2. Backend test, lint, compile, frontend build và Docker build/cache validation đều PASS; nếu môi trường thiếu công cụ thì ghi rõ lý do và validation thay thế, không bỏ qua âm thầm.
  3. Không có `.env`, token, password, authorization header, AWS/Dify/Supabase key, presigned URL, PDF bytes hoặc embedding vector trong output/log/artifact.
  4. Checklist smoke xác nhận owner isolation, bounded processing, canonical cache, chunk contract, S3 readiness TTL/single-flight, healthcheck và EC2 2 GiB resource constraint.
- **Lệnh validation:**
  ```bash
  python -m pytest backend/tests -q
  python -m ruff check backend/app backend/tests
  python -m compileall backend/app
  npm --prefix frontend run build
  ```
- **Requirements:** `_Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_`
