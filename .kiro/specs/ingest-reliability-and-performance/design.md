# Ingest Reliability and Performance — Thiết kế sửa lỗi

## Overview

Thiết kế này sửa sáu nhóm vấn đề trong luồng upload và ingest tài liệu mà không thay đổi mục tiêu của API hiện có, không thêm worker/message queue và không yêu cầu tăng giới hạn EC2 2 GiB. Nguyên tắc chính là dùng một `document_id` làm định danh chuẩn từ lúc nhận upload đến background ingest, giới hạn mọi đường xử lý bằng timeout hữu hạn, chỉ cho phép một chuyển trạng thái cuối hợp lệ, dùng một nguồn cấu hình/cache model duy nhất, tokenize theo cửa sổ token tuyến tính, và tách readiness thật của S3 khỏi liveness của container.

Giải pháp giữ các endpoint, phương thức, schema và trạng thái public hiện tại. Trạng thái lỗi public tiếp tục là `failed` (không thêm trạng thái `error` mới); `ocr_required` vẫn là trạng thái kết thúc dành cho PDF không có lớp text. Các thay đổi response chỉ bổ sung thông tin cần thiết để diễn đạt readiness hoặc lỗi chính xác hơn. Tất cả thao tác background tiếp tục chạy trong process FastAPI hiện tại, nhưng được giới hạn concurrency và không giữ bản sao bytes upload quá thời gian cần thiết.

Các điểm neo đang có trong code được giữ lại và củng cố: `DocumentRepository.create` nhận `document_id` tường minh, `_process_document` đã có timeout, startup đã có đường recovery stale, `model_cache_dir()` và `StorageService.check_cached()` đã là điểm tích hợp cho cache/readiness. Thiết kế bổ sung các guard nguyên tử, xử lý dữ liệu legacy `NULL`, chia sẻ runtime model/tokenizer, single-flight cho readiness và kiểm thử đầy đủ cho cả lỗi lẫn hành vi cần bảo toàn.

## Glossary

- **Bug_Condition (C(X))**: Tập input hoặc trạng thái làm lộ một trong sáu lỗi: lệch định danh, ingest treo, cache không nhất quán, chunking vượt chi phí/giới hạn, readiness báo sai, hoặc vi phạm isolation/tương thích/tài nguyên.
- **Property (P)**: Điều phải đúng sau bản sửa đối với mọi input thuộc `C(X)`; bao gồm kết quả đúng, trạng thái hữu hạn, lỗi an toàn và không tạo bản ghi/chunk mâu thuẫn.
- **Preservation**: Hành vi của `F` (code trước bản sửa) phải tiếp tục được giữ trong `F'` (code sau bản sửa) đối với input không thuộc `C(X)`.
- **document_id**: UUID được sinh đúng một lần cho một lần tạo document; là khóa dùng chung trong DB, storage key, background task, status update, chunk và recovery.
- **owner scope**: Mọi đọc, cập nhật, xóa, ingest và tìm kiếm phải ràng buộc đồng thời bởi `owner_id` và `document_id`; không dùng ID một mình cho đường API của người dùng.
- **processing**: Trạng thái tạm thời của một document đang chờ hoặc đang chạy pipeline.
- **Trạng thái kết thúc**: `ready`, `failed` hoặc `ocr_required`. Không có document nào được phép ở `processing` vô hạn.
- **stale processing**: Document còn `processing` nhưng đã quá deadline kể từ `updated_at`, thường do process bị restart hoặc task bị hủy trước khi ghi kết quả.
- **readiness**: Khả năng instance thực sự truy cập các dependency cần cho traffic, trong đó S3 phải được kiểm tra bằng request thật. **Liveness/health** chỉ cho biết process còn chạy và không được đổi mục tiêu.
- **Cache root chuẩn**: Một thư mục gốc duy nhất, mặc định `/opt/huggingface` trong image, được dùng bởi cả sentence-transformers và transformers tokenizer ở build và runtime.
- **Chunk token window**: Cửa sổ tối đa 220 token, stride mặc định `220 - 32 = 188`, với overlap 32 token giữa các cửa sổ kế tiếp khi dữ liệu đủ dài.
- **Correlation identifier**: `X-Request-ID` hoặc UUID do service sinh, được truyền vào background và log cùng `document_id`; không chứa secret hay nội dung tài liệu.
- **Idempotency**: Chạy lại cùng một document/attempt không tạo chunk trùng hoặc cho phép kết quả cũ ghi đè một trạng thái kết thúc mới hơn.

## Bug Details

### Bug Condition

Lỗi được xác định theo hợp của sáu nhóm điều kiện sau:

1. ID được dùng để tạo storage/background khác ID thật trong row `documents`, hoặc background truy cập document bằng cặp ID/owner không khớp.
2. Một task ở `processing` vượt deadline, bị exception/cancel/restart hoặc không ghi được trạng thái cuối mà không có chuyển đổi hữu hạn sang `failed`/`ocr_required`/`ready`.
3. Build và runtime resolve model/tokenizer bằng model id, cache root hoặc layout khác nhau; runtime âm thầm tải lặp hoặc không tìm thấy cache trong môi trường offline.
4. Chunker tokenize lại cùng dữ liệu theo từng cửa sổ, có chi phí bậc hai, tạo chunk vượt 220 token, làm mất overlap/metadata/id, hoặc không kết thúc với input rỗng/Unicode.
5. `/ready` trả `ready` khi chỉ có tên bucket nhưng `head_bucket` thất bại, hoặc gọi S3 ở mọi lần polling thay vì dùng TTL ngắn có giới hạn.
6. Một thao tác bỏ qua `owner_id`, làm thay đổi route/schema/healthcheck không cần thiết, log secret/dữ liệu nhạy cảm, hoặc tạo concurrency/cache/bản sao dữ liệu vượt ngân sách 2 GiB.

**Đặc tả hình thức:**

```text
FUNCTION isBugCondition(X)
  INPUT: X là một sự kiện create, ingest, recovery, chunking, readiness
         hoặc truy cập API
  OUTPUT: boolean

  RETURN
      (X.kind = "identity" AND X.persisted_document_id != X.scheduled_document_id)
   OR (X.kind = "ingest" AND X.status = "processing"
       AND (X.deadline_expired OR X.interrupted_without_terminal_state))
   OR (X.kind = "cache" AND (X.build_cache_root != X.runtime_cache_root
       OR X.build_model_id != X.runtime_model_id
       OR X.runtime_downloads_outside_canonical_root))
   OR (X.kind = "chunk" AND (X.tokenization_repeated
       OR X.chunk_token_count > 220
       OR X.overlap_not_32_when_possible
       OR X.metadata_or_stable_id_lost
       OR X.does_not_terminate))
   OR (X.kind = "readiness" AND X.reported_ready
       AND NOT X.real_s3_check_succeeded)
   OR (X.kind = "boundary" AND (X.owner_scope_bypassed
       OR X.public_contract_changed_unnecessarily
       OR X.secret_logged
       OR X.memory_budget_exceeded))
END FUNCTION
```

**Đặc tả hành vi đúng:**

```text
FUNCTION expectedBehavior(X, result)
  INPUT: X và result của F'(X)
  OUTPUT: boolean

  IF X.kind = "identity" THEN
    RETURN result.persisted_document_id = result.scheduled_document_id
       AND result.owner_id = X.owner_id
       AND result.no_orphan_job_reference

  IF X.kind = "ingest" THEN
    RETURN result.final_status IN {"ready", "failed", "ocr_required"}
       AND result.status_update_is_owner_scoped
       AND result.error_is_safe_when_failed
       AND result.no_unbounded_retry_or_conflicting_terminal_write

  IF X.kind = "cache" THEN
    RETURN result.resolved_model_id = X.configured_model_id
       AND result.cache_root = X.canonical_cache_root
       AND result.missing_cache_is_observable
       AND result.no_duplicate_cache_root

  IF X.kind = "chunk" THEN
    RETURN result.terminates
       AND EVERY chunk.token_count <= 220
       AND result.overlap_is_32_when_possible
       AND result.metadata_preserved
       AND result.ids_are_stable_and_unique_per_document
       AND result.complexity_is_linear_for_fixed_window_constants

  IF X.kind = "readiness" THEN
    RETURN result.ready = (X.database_ok AND X.dependencies_configured
                           AND X.s3_check_succeeded)
       AND result.s3_calls_are_single_flight_and_ttl_bounded

  IF X.kind = "boundary" THEN
    RETURN result.owner_scope_preserved
       AND result.public_contract_preserved
       AND result.no_secret_in_observability
       AND result.resource_use_within_ec2_2_gib_budget

  RETURN FALSE
END FUNCTION
```

### Các ví dụ biểu hiện lỗi

- **Lệch ID:** API tạo `document_id=A`, tạo storage key và task bằng `A`, nhưng câu `INSERT` để PostgreSQL sinh `B`. Khi task gọi `replace_for_document(owner, A, ...)`, kiểm tra ownership không tìm thấy row và phát sinh `Document does not belong to owner`.
- **Timeout:** `embedding.encode()` bị treo lâu hơn `INGEST_TIMEOUT_SECONDS`; nếu không có guard, row vẫn `processing` và status endpoint không có kết quả cuối. Sau bản sửa row chuyển sang `failed` với thông báo an toàn, còn log có event timeout và correlation ID.
- **Restart:** Process dừng sau khi parse/chunk nhưng trước status update. Khi instance khởi động lại, recovery atomically tìm row `processing` đã stale và chuyển sang `failed`, không tạo task mới vô hạn.
- **Cache:** Build đặt model dưới một layout của `/opt/huggingface`, còn tokenizer runtime tìm một root khác. Container không có mạng sẽ lỗi muộn hoặc tải lại. Sau bản sửa cả build/runtime dùng một root và model id; thiếu cache tạo lỗi rõ ràng.
- **Chunking:** Một trang dài bị tokenize lại cho từng cửa sổ. Với `T` token, chi phí có thể tăng theo số cửa sổ nhân độ dài văn bản. Sau bản sửa trang chỉ được tokenize một lần, sau đó cắt các cửa sổ 220 token với stride 188.
- **Readiness:** `S3_BUCKET_NAME` có giá trị nhưng credentials sai; `/ready` cũ vẫn trả `ready`. Sau bản sửa `head_bucket` thất bại thì `status=not_ready`, `storage_configured=true`, `storage_reachable=false`, và các lần gọi trong 30 giây dùng kết quả cache.
- **Boundary:** Owner B gửi `document_id` của owner A; mọi repository path phải trả 404/không có row, không tiết lộ row tồn tại. Log có thể ghi document/correlation ID nhưng không ghi JWT, AWS key, presigned URL hoặc nội dung PDF.

## Expected Behavior

### Preservation Requirements

Các hành vi sau phải tiếp tục giống trước bản sửa, ngoại trừ việc biểu diễn chính xác hơn tình trạng lỗi/readiness đã nêu:

- Giữ route và method hiện có, gồm `/api/v1/documents/ingest`, các route document/status hiện tại, `/api/v1/health`, `/api/v1/ready` và root `/health`, `/ready`.
- Giữ `202 Accepted` cho ingest thành công ở bước nhận tài liệu, format `IngestResponse`, các field document hiện có và danh sách public status `processing`, `ready`, `failed`, `ocr_required`.
- Giữ `owner_id` scoping cho list/get/url/delete, chunk replace, lexical/vector search, status update và recovery không làm lộ dữ liệu owner khác.
- Giữ storage key theo owner/document, duplicate detection theo `(owner_id, file_hash)`, cleanup object khi DB create thất bại, cùng giới hạn upload hiện tại.
- Giữ metadata page/source/document type, id chunk ổn định và hợp đồng `max_tokens=220`, `overlap=32`; thay đổi thuật toán chỉ nhằm loại bỏ tokenize lặp.
- Giữ `/api/v1/health` là liveness nhẹ. Healthcheck trong `deploy/docker-compose.yml` tiếp tục gọi endpoint này, không thay bằng `/ready` và không bắt health phụ thuộc S3/Dify/model.
- Client hợp lệ không phải thay đổi request. `storage_configured` nếu đã có trong response readiness vẫn được giữ; `storage_reachable` là thông tin bổ sung/được chuẩn hóa để phân biệt cấu hình với khả năng truy cập thật.
- Không đưa thêm worker, queue, process model hoặc bản sao model. Runtime vẫn healthy trong giới hạn EC2 2 GiB và không log secret, authorization header, credentials hay nội dung tài liệu.

### State machine và semantics lỗi/retry

```text
                 parse/embed/persist thành công
              +----------------------------------+
              |                                  v
[processing] --+------------------------------> [ready]
      |         \\                              ^
      |          \\ PDF cần OCR                 |
      |           +--------------------------> [ocr_required]
      |
      +-- timeout / exception / cancel / stale recovery --> [failed]
```

- `processing` được ghi khi row được tạo. Task chỉ nhận `document_id`, `owner_id`, `storage_key`, `doc_type` và correlation ID chuẩn; không tự sinh lại ID.
- Một attempt pipeline có timeout bao trùm parse, chunk, embedding và persist. Timeout hoặc lỗi không thể tiếp tục được bắt, log dưới event an toàn và chuyển sang `failed` với error code/message dành cho API.
- PDF cần OCR chuyển sang `ocr_required` và kết thúc bình thường; không cố embed chunks rỗng.
- Các transition cuối dùng điều kiện `WHERE owner_id=$1 AND id=$2 AND status='processing'`. Nếu một task cũ cố ghi `failed` sau khi task khác đã ghi `ready`, update trả về không có row, được log là transition miss và không ghi đè kết quả mới.
- Recovery tự động chỉ thực hiện một hành động hữu hạn: sửa row legacy `NULL` theo chính sách an toàn và chuyển row `processing` stale sang `failed`. Không tự động chạy lại toàn bộ pipeline vì background task hiện tại không có durable job payload; điều này tránh retry vô hạn và kết quả mâu thuẫn. Người dùng có thể dùng flow upload hiện có để tạo attempt mới theo chính sách duplicate hiện tại.
- Trong một attempt, chỉ retry các thao tác status update ở mức hữu hạn với backoff ngắn nếu lỗi kết nối tạm thời. Không retry parse/embedding vô hạn. Nếu status update cuối vẫn thất bại, log `status_update_failed`; lần startup/read kế tiếp phải nhận diện stale và sửa, thay vì để trạng thái được coi là đang chạy vô hạn.
- `replace_for_document` thực hiện ownership check và xóa/insert trong cùng transaction. Nếu transaction lỗi, toàn bộ thay đổi chunks rollback và pipeline đi đến `failed`; không đánh dấu `ready` khi chưa persist thành công.
- Row có `status`, `page_count` hoặc `chunk_count` `NULL` được coi là dữ liệu legacy không hợp lệ: startup repair đặt status an toàn là `failed`, page/chunk count về `0` nếu thiếu và ghi error message tổng quát. Các query đọc vẫn dùng `COALESCE` phòng thủ để response không lỗi Pydantic trong thời gian repair.

## Hypothesized Root Cause

1. **Nguồn sinh ID không được ràng buộc ở mọi lớp:** Schema có default `gen_random_uuid()`, nên bất kỳ caller nào bỏ trường `id` đều có thể tạo row khác với ID đã đưa vào storage key/background. Lỗi ownership sau đó là triệu chứng của mismatch chứ không phải lỗi quyền.
2. **Trạng thái được cập nhật best-effort nhưng thiếu transition guard:** Task có thể bị timeout, cancellation, process restart hoặc status update không khớp row. Nếu update cuối không kiểm tra trạng thái hiện tại, task cũ cũng có thể ghi đè kết quả của task mới.
3. **Recovery phụ thuộc startup và dữ liệu production không đồng nhất schema:** Row cũ có `NULL` dù schema khai báo default/NOT NULL, khiến response model hoặc filter trạng thái không xử lý được. Recovery chưa có bước normalize NULL độc lập.
4. **Hai thư viện resolve cache bằng các biến/layout khác nhau:** `SentenceTransformer` và `AutoTokenizer` có tham số cache riêng. Nếu build dùng một root còn runtime đọc root khác, image có thể chứa hai bản cache hoặc tải lại ngoài dự kiến.
5. **Chunker có nguy cơ gắn chi phí tokenize với từng đoạn/cửa sổ:** Cách cắt theo word token count phải được bảo đảm không gọi tokenizer lặp, đồng thời cần xử lý token đơn lẻ dài hơn giới hạn để mọi chunk vẫn `<=220`.
6. **Readiness phân biệt chưa đủ giữa configured và reachable:** Bucket có tên không chứng minh credentials, quyền hoặc endpoint S3 hoạt động. Cache boolean hiện tại nếu không single-flight sẽ tạo burst request khi TTL hết hạn đồng thời.
7. **Background giữ bytes và model/vector trong cùng process:** Upload content được giữ tới khi task chạy; nhiều request đồng thời có thể nhân bản bộ nhớ dù container không có OOM trong baseline. Cần giới hạn active ingest và chỉ giữ object reference/storage key khi chờ.

## Correctness Properties

Property 1: Bug Condition - Ingest, cache, chunking và readiness hữu hạn, nhất quán

_For any_ input mà `isBugCondition(X)` trả về `true`, hàm fixed `F'` SHALL dùng đúng document/owner identity, đưa ingest về một trạng thái kết thúc hữu hạn, resolve model/tokenizer từ cache chuẩn, tạo chunks không vượt 220 token với overlap hợp lệ và metadata/id ổn định, đồng thời chỉ báo readiness khi kiểm tra S3 thật thành công; mọi lỗi phải có observability an toàn và không tạo retry/kết quả cuối mâu thuẫn.

**Validates: Requirements 2.1.1, 2.1.2, 2.1.3, 2.1.4, 2.2.1, 2.2.2, 2.2.3, 2.2.4, 2.2.5, 2.2.6, 2.3.1, 2.3.2, 2.3.3, 2.3.4, 2.4.1, 2.4.2, 2.4.3, 2.4.4, 2.4.5, 2.5.1, 2.5.2, 2.5.3, 2.5.4, 3.1, 3.2, 3.3, 3.7**

Property 2: Preservation - API, isolation, healthcheck, metadata và giới hạn tài nguyên

_For any_ input mà `isBugCondition(X)` trả về `false`, fixed `F'` SHALL tạo cùng kết quả observable như original `F` cho hành vi không bị lỗi, tiếp tục áp dụng owner isolation, giữ route/method/schema/ý nghĩa response hiện có, bảo toàn metadata và healthcheck, không log secret, không thêm worker/queue và không vượt ngân sách bộ nhớ hiện tại.

**Validates: Requirements 2.5.5, 2.6.1, 2.6.2, 2.6.3, 2.6.4, 2.6.5, 3.4, 3.5, 3.6, 3.8**

## Fix Implementation

### Kiến trúc và flow đề xuất

1. **Nhận upload và tạo document:** `ingest_document` validate content type/kích thước/PDF, tính hash theo owner, sinh `document_id = uuid4()` đúng một lần. Storage key, `INSERT`, response và background task đều dùng giá trị này. Chỉ gọi `background_tasks.add_task` sau khi upload S3 và DB insert thành công. Nếu DB insert thất bại thì xóa object vừa upload; nếu khởi tạo task thất bại thì giữ row nhưng chuyển có kiểm soát sang `failed`, không tạo job mồ côi.
2. **Chờ/chạy background với bounded resource:** Task nhận `storage_key` thay vì giữ `content` trong closure lâu hơn cần thiết, tải object từ S3 với giới hạn kích thước và chạy dưới một `asyncio.Semaphore` cấp app. Semaphore mặc định cho một ingest model-intensive tại một thời điểm trên EC2 2 GiB; task chờ slot cũng chỉ giữ UUID/key, không giữ bản sao PDF. Timeout bao trùm cả thời gian chờ slot và pipeline.
3. **Pipeline:** Lấy document bằng `(owner_id, document_id)` để xác nhận row còn tồn tại; parse PDF; nếu cần OCR thì transition `processing -> ocr_required`; nếu không, chunk theo page, encode theo batch, ghi chunks transactional rồi transition `processing -> ready` bằng conditional update. Mọi exception, timeout và cancellation đều đi qua một hàm phân loại lỗi và transition `processing -> failed` best-effort.
4. **Recovery:** Sau khi pool khởi tạo, chạy data repair cho NULL và truy vấn atomic `processing` stale. Chỉ ghi count/log an toàn, không trả dữ liệu owner ra ngoài. Khi status endpoint gặp row stale trong lúc repair chưa hoàn tất, response chuẩn hóa thành `failed` và không để Pydantic/filters hỏng vì NULL.
5. **Model runtime:** Tạo provider dùng chung, khởi tạo một lần trong `lifespan`, truyền cùng instance cho `EmbeddingService` và `SmartChunker`. Provider giữ model id, tokenizer, cache root và lock; mọi load đều qua provider, không tự resolve cache trong từng service.
6. **Readiness:** `StorageService.check()` gọi `head_bucket` thật; `check_cached()` dùng `time.monotonic()`, cache cả kết quả thành công và thất bại, TTL cấu hình ngắn và lock single-flight. `/ready` và `/api/v1/ready` dùng cùng kết quả; `/health` và healthcheck Compose không gọi S3.

### Module/file ảnh hưởng

| Module/file | Thay đổi thiết kế |
|---|---|
| `backend/app/api/v1/documents.py` | Giữ orchestration route; truyền cùng `document_id`, `owner_id`, `storage_key`, correlation ID; timeout toàn pipeline; phân loại lỗi và status transition có guard; không đưa raw exception/secret vào response. Background nên tải từ storage key và dùng semaphore. |
| `backend/app/db/repositories/document_repo.py` | Giữ `create(..., document_id=...)`; thêm transition `processing -> terminal` có điều kiện owner/id/status, retry status update hữu hạn, repair/coalesce NULL, stale recovery và query trả dữ liệu hợp lệ. Không thêm đường query chỉ theo `document_id` cho API owner. |
| `backend/app/db/repositories/chunk_repo.py` | Giữ owner check; làm `replace_for_document` transactional/idempotent, kiểm tra document còn `processing` trước khi thay chunks và không cho task stale ghi kết quả sau terminal state. Các search path tiếp tục join với document và lọc owner. |
| `backend/app/services/ingest.py` (mới, nếu tách orchestration) | Chứa state machine, timeout, bounded retry, safe error mapping, correlation logging và semaphore; nếu không tách file thì các hàm tương ứng vẫn phải được cô lập trong `documents.py` để tránh logic rải rác. |
| `backend/app/services/model_runtime.py` (mới) | Provider duy nhất cho model/tokenizer: kiểm tra model id/cache root, lazy-load có lock, chế độ local/offline khi runtime, lỗi thiếu cache rõ ràng và không tạo root thứ hai. |
| `backend/app/services/embedding.py` | Nhận provider dùng chung thay vì tự tạo cache/model độc lập; giữ batch size, dimension check và `asyncio.to_thread`; không load lại model cho mỗi document. |
| `backend/app/services/chunker.py` | Tokenize một lần cho mỗi page/đơn vị xử lý, cắt ID token bằng cửa sổ 220/stride 188, decode từng cửa sổ, xử lý fallback/Unicode/empty input, giữ metadata và hash ID hiện có. |
| `backend/app/services/storage.py` | Thêm download có giới hạn nếu background không giữ bytes; `check()` dùng S3 thật; `check_cached()` có TTL setting, lock single-flight, cache failure và log lỗi đã redacted, không log credentials. |
| `backend/app/core/config.py` | Chuẩn hóa `MODEL_CACHE_DIR`/canonical cache root, giữ `EMBEDDING_MODEL`, dùng `INGEST_TIMEOUT_SECONDS`, thêm TTL readiness hữu hạn và giới hạn retry/concurrency với giá trị mặc định phù hợp 2 GiB. Validate giá trị dương và giới hạn TTL/concurrency. |
| `backend/app/main.py` | Khởi tạo shared model runtime, semaphore và storage readiness cache; chạy NULL repair/stale recovery sau pool; truyền dependency dùng chung; shutdown không làm mất cơ chế cancellation. |
| `backend/app/api/v1/system.py`, `backend/app/schemas/system.py` | `/ready` tính `storage_configured` và `storage_reachable` riêng, giữ response tương thích và dùng TTL; `/health` không đổi. |
| `backend/app/db/migrations/001_init.sql` và migration dữ liệu triển khai | Không thêm cột mới. Bổ sung migration/data repair idempotent nếu production thật sự có NULL hoặc constraint lệch: normalize status/count/error và xác nhận NOT NULL/default/check hiện hành. Query runtime vẫn phòng thủ với `COALESCE`. |
| `backend/Dockerfile` | Dùng cùng model id và canonical `/opt/huggingface` ở build/runtime; đặt các biến cache về cùng root, tạo manifest model id tùy chọn để runtime kiểm tra, build offline verification sau khi cache được tạo và không tạo layout root thứ hai. |
| `deploy/docker-compose.yml` | Truyền cùng `EMBEDDING_MODEL` cho build và runtime; giữ một service/container, không thêm worker/queue; giữ nguyên healthcheck `/api/v1/health`, interval/timeout/start period trừ khi cần điều chỉnh thời gian startup model. |
| `backend/tests/` | Mở rộng unit, property và integration tests cho sáu nhóm, dùng fake S3/DB/model; test không đọc secrets hay cần dependency production. |

### Chi tiết state, lỗi và observability

Mỗi event ingest ghi tối thiểu `event`, `document_id`, `correlation_id`, `from_status`, `to_status` (nếu có), thời gian/elapsed và error code tổng quát. Các event bắt buộc là `ingest_created`, `ingest_started`, `ingest_ocr_required`, `ingest_completed`, `ingest_timeout`, `ingest_retry_status`, `ingest_recovery`, `ingest_failed`, `storage_check_failed` và `ownership_mismatch`. Có thể đếm các event này thành metric nội bộ/metric collector hiện có, nhưng không thêm dependency nặng chỉ để đo đếm.

Error mapping dùng allowlist, ví dụ `timeout`, `pdf_invalid`, `ocr_required`, `embedding_unavailable`, `storage_unavailable`, `database_unavailable`, `ownership_mismatch`, `cancelled`, `stale_recovered`. API chỉ nhận message tiếng Việt an toàn tương ứng; traceback và exception class được log ở mức phù hợp sau khi redaction. Không ghi token, password, AWS/Supabase/Dify key, authorization header, presigned URL, PDF bytes, full document content hoặc embedding vectors.

### Cache model/tokenizer

Canonical root được chọn là `/opt/huggingface` trong image. `HF_HOME`, `SENTENCE_TRANSFORMERS_HOME` và biến nội bộ `MODEL_CACHE_DIR` phải cùng trỏ về root này; nếu runtime phát hiện hai giá trị khác nhau thì fail fast với lỗi cấu hình quan sát được thay vì chọn một giá trị theo thứ tự ngầm. Build arg `EMBEDDING_MODEL` và runtime `EMBEDDING_MODEL` phải giống nhau; manifest trong image hoặc bước kiểm tra build ghi model id để phát hiện mismatch.

`ModelRuntime` được khởi tạo một lần và cung cấp tokenizer cho chunker, embedding model cho embedding service. Runtime dùng local-files-only/offline resolution sau khi image đã build; thiếu file cache hoặc cache không khớp model id làm ingest `failed` với error code rõ ràng. Không coi sự tồn tại của một thư mục con bất kỳ là cache hợp lệ và không fallback sang root thứ hai. Lazy loading vẫn được giữ để test/local nhẹ, nhưng lần load đầu tiên dùng lock và không tạo bản sao đồng thời.

### Chunking

Đối với mỗi page có text, chunker chuẩn hóa và tokenize đúng một lần. Với tokenizer thật, giữ token IDs/offset cần thiết trong phạm vi page rồi tạo các cửa sổ tối đa 220 token, stride 188; cửa sổ cuối ngắn hơn được giữ nguyên và không ép đủ overlap khi không thể. Với fallback whitespace tokenizer, dùng cùng quy tắc cửa sổ và bảo đảm token count không vượt 220. Input rỗng bị bỏ qua hữu hạn; page ngắn tạo một chunk; Unicode hợp lệ được truyền nguyên vẹn qua tokenizer/decoder.

Mỗi chunk giữ `page`, `page_start`, `page_end`, `chunk_index`, `document_type` và `token_count`; nếu có metadata nguồn hiện hữu thì merge thay vì thay thế. ID tiếp tục là digest deterministic từ `document_id`, page, local index và normalized content, nên rerun cùng input cho cùng document cho cùng ID và các document khác nhau không đụng nhau. Với giới hạn cửa sổ cố định, mỗi token xuất hiện trong số cửa sổ hữu hạn, nên thời gian tokenize/cắt tăng tuyến tính theo kích thước input.

### Readiness S3 và healthcheck

`StorageService.check()` trả `false` khi bucket thiếu, `head_bucket` ném exception, credentials không hợp lệ hoặc quyền không đủ; không suy diễn readiness từ `bool(bucket)`. `check_cached()` cache timestamp monotonic và kết quả false/true trong TTL mặc định ngắn (đề xuất 30 giây, có thể cấu hình trong giới hạn 1–300 giây). Khi nhiều request đến lúc hết hạn, lock đảm bảo chỉ một request gọi S3; các request còn lại dùng kết quả vừa cập nhật.

`/api/v1/ready` trả `status=ready` chỉ khi database, storage configured, storage reachable, Dify và embedding configured đều đúng. `/ready` root dùng cùng storage check nhưng giữ response đơn giản. Hết TTL thì lần gọi kế tiếp bắt buộc kiểm tra lại S3. `/api/v1/health` và `/health` chỉ phản ánh process/liveness; `deploy/docker-compose.yml` tiếp tục healthcheck `/api/v1/health`, vì nếu đổi sang readiness thì outage S3 sẽ làm container bị restart liên tục và che khuất lỗi dependency.

### Owner, API, security và resource constraints

- Background task không tin owner/document từ payload có thể sửa; các giá trị được chụp từ request đã authenticate và mọi query dùng cặp `(owner_id, document_id)`.
- Recovery bulk không nhận owner từ client, chỉ cập nhật row stale theo điều kiện trạng thái/thời gian và chỉ trả count; đây là maintenance nội bộ, không phải đường đọc dữ liệu.
- `get/list/stats` normalize NULL để status API không crash; status lỗi public là `failed`, không đổi literal để giữ client hiện tại.
- Upload bytes được giải phóng sau request; background giữ `storage_key`, giới hạn object tải lại, semaphore giới hạn ingest active, embedding giữ batch nhỏ và model/tokenizer singleton. Không tạo process/worker mới, không nhân đôi cache.
- Các retry đều bounded: status update tối đa một số lần nhỏ với backoff; pipeline không retry vô hạn; stale recovery chuyển failed một lần theo điều kiện atomic.

### Ảnh hưởng triển khai

1. Trước rollout, chạy data repair idempotent trên database production để normalize row `NULL`/stale và xác nhận không có schema drift; không cần thêm cột hoặc thay đổi chính sách RLS.
2. Build image phải có network ở giai đoạn tải model, dùng đúng `EMBEDDING_MODEL` và `/opt/huggingface`; sau khi build có thể chạy runtime trong network hạn chế/offline để xác nhận local load. Không đọc hoặc ghi secret vào image.
3. Runtime Compose tiếp tục một service API với `restart: unless-stopped`; không mở port mới. Đặt các biến không nhạy cảm cho timeout, readiness TTL, model id/cache root nhất quán giữa build và runtime qua cơ chế deploy hiện có.
4. Sau restart, kiểm tra log startup recovery, gọi `/api/v1/health` để xác nhận liveness và `/api/v1/ready` để xác nhận S3/database thật. Không dùng `/ready` làm healthcheck liveness.
5. Theo dõi log event timeout/recovery/status-update-miss, số lần S3 check trong một TTL, thời gian chunking/embedding và RSS container. Nếu cache thiếu hoặc model id lệch, rollout phải fail rõ ràng thay vì cho traffic chạy với tải model ngoài dự kiến.

## Testing Strategy

### Validation Approach

Kiểm thử theo bốn lớp: (1) exploratory test chạy trên code chưa sửa để ghi lại counterexample của từng bug; (2) preservation test chạy trước bản sửa để chốt baseline; (3) fix/property test chạy lại đúng test đó sau bản sửa; (4) integration/deployment smoke test với fake dependency và môi trường network hạn chế. Không dùng AWS/S3 production, database production, secret thật hoặc model download ngoài dự kiến trong test.

### Exploratory Bug Condition Checking

Các exploratory test phải được viết và chạy trên UNFIXED code trước khi sửa, failure là kết quả mong đợi và phải ghi counterexample:

1. Tạo row với DB fake tự sinh ID khác ID task, chạy pipeline và xác nhận ownership mismatch.
2. Cho `encode` sleep vượt timeout, xác nhận row cũ vẫn `processing` hoặc status update hiện tại chưa đủ; dùng counterexample này để kiểm tra transition cần thêm.
3. Hủy task/restart giả lập với row `processing` cũ và row `NULL`, ghi lại response/status lỗi hiện tại.
4. Mock build/runtime dùng hai cache root hoặc model id khác nhau trong offline mode, xác nhận runtime lookup/tải lặp.
5. Sinh page dài, đo số lần tokenizer gọi và kiểm tra trường hợp từ/token dài, Unicode, empty input và overlap.
6. Mock `head_bucket` false/raise nhưng bucket string truthy; gọi `/ready` liên tiếp để ghi readiness sai và số request S3.
7. Gọi document/chunk path bằng owner khác, kiểm tra mọi route; kiểm tra log fixture có thể chứa secret hay không và đo concurrency memory baseline.

### Fix Checking

Sau khi cài đặt, chạy lại cùng input/counterexample, không viết một test khác để che failure:

```text
FOR ALL X WHERE isBugCondition(X) DO
  result := F'(X)
  ASSERT expectedBehavior(X, result)
END FOR
```

Tối thiểu phải chứng minh: persisted/scheduled ID giống nhau; timeout/cancel/stale không còn `processing` vô hạn; status cuối không bị task cũ ghi đè; cache thiếu/mismatch fail rõ; chunk luôn `<=220` và overlap đúng khi có thể; `/ready` phụ thuộc `head_bucket` và không tạo request lặp trong TTL.

### Preservation Checking

Trước bản sửa, quan sát và ghi output của input không thuộc bug condition; sau bản sửa chạy lại cùng test:

```text
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT observable(F(X)) = observable(F'(X))
END FOR
```

Các baseline phải bao gồm upload PDF hợp lệ/duplicate, OCR-required, mouse/API document access hợp lệ, search theo owner, chunk ngắn và Unicode, `/health` 200 không cần S3, healthcheck Compose vẫn gọi `/api/v1/health`, response schema và status literal. Chỉ readiness status/field được thay đổi theo đúng requirement khi S3 unreachable.

### Unit Tests

- `DocumentRepository.create`: ID explicit bắt buộc, storage key/task cùng UUID; insert lỗi cleanup không tạo job.
- Repository state transitions: chỉ `processing` mới được chuyển terminal; owner sai/ID sai trả no-row; terminal cũ không bị ghi đè; recovery chỉ xử lý stale và NULL, không trả owner data.
- `_process_document`/ingest service: success, OCR, parse error, embedding error, timeout, cancellation, status-update retry exhausted; error API bị redacted.
- Chunker: empty/short/long/Unicode, token window 220, overlap 32, token đơn lẻ dài, metadata và digest id ổn định; spy tokenizer xác nhận một lần mỗi page.
- Shared model runtime: cùng provider được inject cho chunker/embedding, model/tokenizer load một lần, cache root/model id mismatch và missing cache fail rõ.
- Storage readiness: bucket trống, `head_bucket` success/failure/exception, cache hit/expiry, concurrent expiry single-flight, cached failure và TTL giới hạn.
- API contract: route/method/status/schema cũ, `storage_configured` không bị xóa, `storage_reachable` phản ánh S3; `/health` không gọi S3.
- Logging/security: log có event/document/correlation cần thiết nhưng không chứa token, password, authorization header, credentials, URL có secret, PDF content hoặc vector.

### Property-Based Tests

- **Property 1 — Bug Condition:** sinh các case identity/timeout/stale/cache/chunk/readiness theo `isBugCondition`; thu hẹp seed cố định cho deterministic failure ở exploratory phase, sau đó chạy domain rộng sau fix.
- **Property 2 — Preservation:** sinh owner UUID khác nhau, document IDs, status non-bug, text Unicode/độ dài trong giới hạn, các key không nhạy cảm và dependency healthy; so sánh observable behavior với baseline `F`.
- Sinh văn bản có `T` token tăng dần để kiểm tra số lần tokenize và thời gian tăng tuyến tính trong sai số hợp lý; assert mọi chunk `<=220`, overlap bằng 32 khi đủ token và ID unique/stable.
- Sinh chuỗi readiness calls với thời điểm trong/ngoài TTL và các kết quả S3 success/failure; assert số `head_bucket` không vượt một lần cho mỗi cửa sổ TTL và hết TTL phải refresh.
- Sinh xen kẽ success/failure/cancel của nhiều task cùng document; assert chỉ có một terminal transition hợp lệ, không có `ready` sau `failed` do task stale và không có chunk duplicate.

### Integration Tests

- Ingest end-to-end với fake storage, fake parser, fake tokenizer/embedding và fake asyncpg: upload tạo đúng row, background dùng cùng ID/owner, chunks và status `ready` nhất quán.
- Restart/recovery: seed row `processing` cũ, row `processing` mới, row `NULL`, chạy lifespan recovery và xác nhận chỉ row phù hợp được normalize/fail.
- Owner isolation: owner A tạo document; owner B thử get/list/status/delete/chunk/search bằng ID A và chỉ nhận hành vi 404/empty phù hợp, không lộ metadata.
- Readiness matrix: database/S3/Dify/embedding từng dependency lần lượt healthy/unhealthy; `/ready` phản ánh đúng, `/health` và Compose healthcheck vẫn healthy khi chỉ S3 lỗi.
- Cache/offline: build fixture với canonical root và model manifest, chạy runtime không mạng; assert model/tokenizer load được từ cache, mismatch/missing cache tạo lỗi quan sát được và không tạo root thứ hai.
- Full resource smoke: nhiều upload đồng thời dưới 2 GiB fixture, assert semaphore/batch không làm tăng active model copies, không có task giữ bytes ngoài thời gian cần thiết và container không OOM.

### Kiểm tra deploy/smoke sau rollout

- Kiểm tra image chứa một canonical cache root và model id đúng cấu hình, không kiểm tra bằng cách in nội dung secret.
- Gọi `/api/v1/health` theo đúng healthcheck hiện tại và `/api/v1/ready` với S3 thật trong cửa sổ TTL; đối chiếu số request S3 với polling.
- Tạo một PDF nhỏ, theo dõi chuỗi event `created -> started -> completed`; thử timeout có kiểm soát và xác nhận `failed`/recovery.
- Kiểm tra RSS, số task đang chạy, số status-update-miss, timeout/recovery và log redaction trước khi mở traffic đầy đủ.
