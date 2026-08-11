# Requirements Document

## Introduction

Tài liệu này đặc tả yêu cầu cho việc tạm ngưng toàn bộ tính năng AI của StudyRAG V2 (embedding, hybrid retrieval, sinh câu trả lời qua Dify, chat streaming) nhằm phục vụ mục tiêu upgrade: giảm kích thước container image và mức tiêu thụ RAM, đồng thời cho phép nâng version dependency mà không bị ràng buộc bởi `torch`/`transformers`.

Quyết định phạm vi đã được chốt: tính năng AI được điều khiển bằng một feature flag (`AI_FEATURES_ENABLED`) để có thể bật lại; các dependency machine learning nặng (`torch`, `sentence-transformers`, `transformers`) được gỡ khỏi runtime; `PyMuPDF` được giữ lại để tiếp tục parse PDF; database schema (`document_chunks`, `messages.citations`, `conversations.dify_conversation_id`, index HNSW/tsvector) được giữ nguyên, không drop; frontend giữ route `/chat` nhưng hiển thị placeholder tiếng Việt; các test phụ thuộc AI được skip có điều kiện thay vì xóa.

Trạng thái hiện tại đã được xác minh trong workspace: `backend/app/main.py` khởi tạo `DifyClient`, `EmbeddingService`, `SmartChunker`, `HybridRetriever` trong lifespan; `backend/app/api/v1/chat.py` gọi `retriever.search()` rồi `dify.stream_chat()`; `backend/app/api/v1/documents.py` chạy pipeline parse → chunk → embed → `chunk_repo.replace_for_document()` → status `ready`; `backend/app/api/v1/system.py` báo readiness dựa trên `dify_configured` và `embedding_configured`; `backend/Dockerfile` tải model embedding (~500 MB) vào `/opt/huggingface` lúc build; `frontend/src/lib/api.ts` cung cấp `api.streamChat`; `frontend/src/components/layout/Sidebar.tsx` và `frontend/src/pages/DashboardPage.tsx` liên kết tới `/chat`.

Ghi nhận xung đột với spec khác: spec `ingest-reliability-and-performance` có 17 task đều ở trạng thái `pending`, trong đó `IRP-003`, `IRP-004`, `IRP-008`, `IRP-009`, `IRP-013`, `IRP-014` đặc tả hành vi cache model/tokenizer và chunker tokenize tuyến tính. Các task này mất căn cứ khi embedding bị tắt, nên spec đó cần được thu hẹp về phần còn hợp lệ (`IRP-001`, `IRP-002`, `IRP-005`, `IRP-006`, `IRP-007`, `IRP-010`, `IRP-011`, `IRP-012`, `IRP-015`). Yêu cầu 9 dưới đây đặc tả nghĩa vụ ghi nhận việc thu hẹp này.

## Glossary

- **AI_Feature_Flag**: Biến cấu hình boolean `AI_FEATURES_ENABLED` trong `backend/app/core/config.py`, mặc định `false` sau khi thay đổi này được áp dụng. Giá trị được phân giải đúng một lần lúc khởi động tiến trình backend và không đổi trong suốt vòng đời tiến trình; thay đổi biến môi trường chỉ có hiệu lực sau khi khởi động lại tiến trình.
- **AI_Disabled_Mode**: Trạng thái vận hành khi `AI_Feature_Flag` có giá trị `false`.
- **AI_Enabled_Mode**: Trạng thái vận hành khi `AI_Feature_Flag` có giá trị `true`.
- **Ingest_Pipeline**: Chuỗi xử lý tài liệu trong `backend/app/api/v1/documents.py` gồm parse, chunk, embed, lưu chunk và cập nhật trạng thái.
- **Storage_Only_Ingest**: Biến thể của `Ingest_Pipeline` ở `AI_Disabled_Mode`, chỉ upload PDF, tạo document row, parse để lấy `page_count`, và không chunk, không embed, không ghi `document_chunks`.
- **Chat_Endpoint**: Route `POST /api/v1/chat` trong `backend/app/api/v1/chat.py`.
- **Conversation_Endpoints**: Các route `/api/v1/conversations` trong `backend/app/api/v1/conversations.py`.
- **Readiness_Endpoint**: Route `GET /api/v1/ready` trong `backend/app/api/v1/system.py` và route `GET /ready` trong `backend/app/main.py`.
- **ML_Dependencies**: Các package machine learning `torch`, `sentence-transformers`, `transformers` và `numpy` mà `EmbeddingService`, `HybridRetriever` và `SmartChunker` phụ thuộc. Sau thay đổi này, các package này thuộc tập dependency AI tùy chọn, không được cài vào `Runtime_Image` ở `AI_Disabled_Mode`.
- **Build_Pipeline**: Quá trình build và kiểm tra `Runtime_Image` từ `backend/Dockerfile`, gồm bước cài dependency, bước xác minh tập package đã cài, và bước quyết định publish hay dừng thất bại.
- **Runtime_Image**: Container image được build từ `backend/Dockerfile`.
- **Chat_Placeholder**: Thành phần frontend hiển thị thông báo tiếng Việt về việc tạm ngưng hỏi đáp AI tại route `/chat`.
- **API_Client**: Module `frontend/src/lib/api.ts`.
- **Feature_Status_Field**: Trường boolean `ai_enabled` trong response của `Readiness_Endpoint`, cho phép frontend biết trạng thái flag.
- **Document_Status**: Giá trị cột `documents.status`, thuộc tập `processing`, `stored`, `ready`, `failed`, `ocr_required`.
- **Indexed_Status**: Giá trị `Document_Status` mới `stored` biểu thị tài liệu đã lưu trữ nhưng chưa lập chỉ mục.
- **Owner_Scope**: Ràng buộc mọi truy vấn và cập nhật dữ liệu theo `owner_id` của người dùng đã xác thực, kết hợp RLS PostgreSQL.

## Requirements

### Requirement 1: Feature flag điều khiển tính năng AI

**User Story:** Là người vận hành StudyRAG, tôi muốn một cấu hình duy nhất bật/tắt toàn bộ tính năng AI, để có thể tạm ngưng và bật lại mà không cần sửa code.

#### Acceptance Criteria

1. THE Settings SHALL cung cấp trường boolean `ai_features_enabled` đọc từ biến môi trường `AI_FEATURES_ENABLED`, trong đó các giá trị `true`, `1`, `yes`, `on` (không phân biệt chữ hoa/chữ thường, bỏ khoảng trắng đầu và cuối) được hiểu là `true`, các giá trị `false`, `0`, `no`, `off` được hiểu là `false`, và giá trị mặc định khi biến không có mặt là `false`.
2. WHEN biến môi trường `AI_FEATURES_ENABLED` không được đặt hoặc chỉ chứa khoảng trắng, THE Settings SHALL trả về `false` cho `ai_features_enabled` và không phát sinh lỗi khởi động.
3. IF biến môi trường `AI_FEATURES_ENABLED` có giá trị không thuộc tập giá trị hợp lệ nêu ở tiêu chí 1, THEN THE FastAPI_Application SHALL dừng khởi động tiến trình tại thời điểm cấu hình được phân giải lần đầu, ở bước import module cấu hình hoặc ở bước lifespan startup tùy nơi nào đến trước, với lỗi cấu hình nêu rõ tên biến và tập giá trị hợp lệ, và SHALL không âm thầm rơi về giá trị mặc định.
4. WHERE `AI_Feature_Flag` có giá trị `false`, THE FastAPI_Application SHALL hoàn tất lifespan startup trong vòng tối đa 30 giây mà không khởi tạo `EmbeddingService`, `HybridRetriever`, `DifyClient`, `SmartChunker`, không import `ML_Dependencies` và không thực hiện bất kỳ lượt tải model nào qua mạng.
5. WHERE `AI_Feature_Flag` có giá trị `true`, THE FastAPI_Application SHALL khởi tạo `EmbeddingService`, `HybridRetriever`, `DifyClient` và `SmartChunker` theo hành vi hiện có.
6. WHERE `AI_Feature_Flag` có giá trị `true`, IF một hoặc nhiều `ML_Dependencies` không khả dụng trong môi trường runtime, THEN THE FastAPI_Application SHALL dừng lifespan startup với lỗi nêu rõ tập dependency AI tùy chọn còn thiếu, và SHALL không tự động chuyển sang `AI_Disabled_Mode`.
7. WHILE tiến trình backend đang chạy, WHEN `AI_Feature_Flag` được đọc bởi bất kỳ thành phần nào, THE Settings SHALL trả về đúng giá trị đã xác định tại thời điểm khởi động tiến trình, và thay đổi biến môi trường sau đó SHALL chỉ có hiệu lực sau khi tiến trình được khởi động lại.
8. THE Backend_Codebase SHALL giữ nguyên các module `app/services/embedding.py`, `app/services/retriever.py`, `app/services/dify.py` và `app/services/chunker.py` trong repository ở trạng thái import được khi `ML_Dependencies` đã được cài, để cho phép bật lại tính năng AI chỉ bằng thay đổi cấu hình.
9. THE Backend_Configuration_Example SHALL ghi trong `backend/.env.example` biến `AI_FEATURES_ENABLED` với giá trị mặc định `false`, tập giá trị hợp lệ, và ghi chú rằng đặt `true` yêu cầu cài thêm tập dependency AI tùy chọn.

### Requirement 2: Chat_Endpoint trả về lỗi xác định ở AI_Disabled_Mode

**User Story:** Là người dùng đã đăng nhập, tôi muốn nhận thông báo rõ ràng bằng tiếng Việt khi gửi câu hỏi trong lúc tính năng AI tạm ngưng, để biết cần chờ thay vì nghĩ hệ thống bị lỗi.

#### Acceptance Criteria

1. WHILE hệ thống ở `AI_Disabled_Mode`, WHEN một request đã xác thực được gửi tới `Chat_Endpoint`, THE Chat_Endpoint SHALL trả về đúng một response không streaming với HTTP status 503 và mã lỗi `ai_features_disabled`, hoàn tất trong vòng 500 ms tính từ lúc nhận request.
2. WHILE hệ thống ở `AI_Disabled_Mode`, WHEN một request đã xác thực được gửi tới `Chat_Endpoint`, THE Chat_Endpoint SHALL trả về thông báo tiếng Việt không rỗng, dài từ 20 đến 200 ký tự, nêu rõ hai thông tin: tính năng hỏi đáp AI đang tạm ngưng và người dùng có thể thử lại sau.
3. WHILE hệ thống ở `AI_Disabled_Mode`, WHEN một request đã xác thực được gửi tới `Chat_Endpoint`, THE Chat_Endpoint SHALL trả về lỗi mà không tạo thêm bản ghi nào trong bảng `conversations` và không ghi thêm bản ghi nào vào bảng `messages`, sao cho số bản ghi của người dùng trong hai bảng này trước và sau request bằng nhau.
4. WHILE hệ thống ở `AI_Disabled_Mode`, WHEN một request đã xác thực được gửi tới `Chat_Endpoint`, THE Chat_Endpoint SHALL phát ra 0 request tới Dify.
5. WHILE hệ thống ở `AI_Disabled_Mode`, WHEN một request đã xác thực được gửi tới `Chat_Endpoint`, THE Chat_Endpoint SHALL thực hiện 0 truy vấn vector và 0 truy vấn full-text trên bảng `document_chunks`.
6. WHILE hệ thống ở `AI_Disabled_Mode`, WHEN một request thiếu bearer token, mang token sai định dạng hoặc mang token đã hết hạn được gửi tới `Chat_Endpoint`, THE Chat_Endpoint SHALL trả về HTTP status 401 theo hành vi xác thực hiện có và SHALL không trả về mã lỗi `ai_features_disabled`.
7. WHILE hệ thống ở `AI_Enabled_Mode`, WHEN một request hợp lệ được gửi tới `Chat_Endpoint`, THE Chat_Endpoint SHALL giữ nguyên hành vi SSE hiện có gồm đúng các tên event `token`, `done`, `error` và các header `X-Conversation-ID`, `X-User-Message-ID` với giá trị không rỗng.
8. WHILE hệ thống ở `AI_Disabled_Mode`, WHEN một request đã xác thực được gửi tới `Chat_Endpoint` với body hợp lệ về cú pháp JSON nhưng không thỏa schema `ChatRequest`, với `document_id` không tồn tại hoặc với `conversation_id` không thuộc người dùng, THE Chat_Endpoint SHALL vẫn trả về HTTP status 503 với mã lỗi `ai_features_disabled`, tức là kiểm tra cờ `AI_FEATURES_ENABLED` chạy sau bước xác thực và trước mọi bước kiểm tra hợp lệ, kiểm tra quyền sở hữu và giới hạn tần suất.
9. WHILE hệ thống ở `AI_Disabled_Mode`, IF body của request tới `Chat_Endpoint` không parse được thành JSON, THEN THE Chat_Endpoint SHALL trả về HTTP status 422 theo hành vi validation sẵn có của framework, và kết quả này SHALL không được coi là vi phạm cổng kiểm tra cờ `AI_FEATURES_ENABLED` nêu ở tiêu chí 8.
10. WHILE hệ thống ở `AI_Disabled_Mode`, WHEN một request đã xác thực được gửi tới `Chat_Endpoint`, THE Chat_Endpoint SHALL không mở kênh SSE: response không dùng kiểu nội dung `text/event-stream`, không chứa event `token`, `done`, `error` và không chứa header `X-Conversation-ID`, `X-User-Message-ID`.
11. IF cờ `AI_FEATURES_ENABLED` không được cấu hình hoặc mang giá trị không phân giải được thành true/false, THEN THE Chat_Endpoint SHALL xử lý mọi request như ở `AI_Disabled_Mode`.

### Requirement 3: Storage_Only_Ingest ở AI_Disabled_Mode

**User Story:** Là học sinh, tôi muốn vẫn upload và quản lý PDF trong lúc tính năng AI tạm ngưng, để thư viện tài liệu của tôi không bị mất và sẵn sàng cho lần lập chỉ mục sau.

#### Acceptance Criteria

1. WHILE hệ thống ở `AI_Disabled_Mode`, WHEN một PDF có content type thuộc tập `application/pdf`, `application/octet-stream` hoặc rỗng, kích thước không vượt 50 MB (52.428.800 byte), bắt đầu bằng magic bytes `%PDF-` và không trùng `(owner_id, file_hash)` được upload, THE Documents_Endpoint SHALL upload file lên S3, tạo document row thuộc `Owner_Scope` với `Document_Status` bằng `processing` và `chunk_count` bằng 0, rồi trả về document vừa tạo.
2. WHILE hệ thống ở `AI_Disabled_Mode`, WHEN `Storage_Only_Ingest` chạy trên một document row vừa được tạo, THE Ingest_Pipeline SHALL parse PDF để xác định `page_count` là số nguyên lớn hơn hoặc bằng 1, SHALL thực hiện 0 lần gọi chunker và SHALL thực hiện 0 lần gọi embedding service.
3. WHILE hệ thống ở `AI_Disabled_Mode`, WHEN `Storage_Only_Ingest` hoàn tất trên PDF trích xuất được lớp text ở tối thiểu một trang, THE Ingest_Pipeline SHALL đặt `Document_Status` thành `stored` với `chunk_count` bằng 0, `page_count` bằng số trang parse được và `error_message` bằng null.
4. WHILE hệ thống ở `AI_Disabled_Mode`, WHEN parse PDF không trích xuất được lớp text ở bất kỳ trang nào, THE Ingest_Pipeline SHALL đặt `Document_Status` thành `ocr_required` với `page_count` bằng số trang parse được, `chunk_count` bằng 0 và `error_message` tiếng Việt nêu rõ tài liệu cần OCR trước khi lập chỉ mục.
5. IF `Storage_Only_Ingest` gặp lỗi parse PDF hoặc lỗi ghi dữ liệu, THEN THE Ingest_Pipeline SHALL đặt `Document_Status` thành `failed` kèm `error_message` tiếng Việt dài tối đa 1000 ký tự, SHALL giữ nguyên document row cùng object S3 đã upload và SHALL giữ `chunk_count` bằng 0.
6. WHILE hệ thống ở `AI_Disabled_Mode`, THE Ingest_Pipeline SHALL thực hiện 0 thao tác INSERT, UPDATE hoặc DELETE trên bảng `document_chunks`.
7. WHILE hệ thống ở `AI_Disabled_Mode`, WHEN người dùng gọi các endpoint list, get, stats, presigned URL hoặc delete document, THE Documents_Endpoint SHALL giữ nguyên route, phương thức HTTP, mã trạng thái thành công và đúng tập trường response hiện có, không thêm và không loại bỏ trường nào, với presigned URL hết hạn sau 900 giây.
8. WHILE hệ thống ở `AI_Enabled_Mode`, WHEN một PDF hợp lệ theo tiêu chí ở tiêu chí 1 được upload, THE Ingest_Pipeline SHALL giữ nguyên chuỗi parse, chunk, embed, lưu chunk transactional và đặt `Document_Status` thành `ready` với `chunk_count` bằng số chunk đã lưu.
9. THE Document_Status_Contract SHALL bao gồm giá trị `stored` trong ràng buộc CHECK của cột `documents.status`, trong tập giá trị hợp lệ của bộ lọc `status` ở endpoint list document, trong bộ đếm của endpoint stats với giá trị mặc định 0, và trong type `DocumentStatus` của `API_Client`.
10. WHEN người dùng gọi endpoint list document với `status=stored`, THE Documents_Endpoint SHALL trả về đúng các document thuộc `Owner_Scope` có `Document_Status` bằng `stored`, kèm `total` bằng số document thỏa điều kiện, và SHALL không trả về document của owner khác.
11. IF request ingest có content type ngoài tập cho phép, kích thước vượt 50 MB, không bắt đầu bằng magic bytes `%PDF-`, hoặc trùng `(owner_id, file_hash)` trong `Owner_Scope`, THEN THE Documents_Endpoint SHALL từ chối request với mã lỗi tương ứng `unsupported_media_type`, `file_too_large`, `invalid_pdf` hoặc `duplicate_document` kèm thông báo tiếng Việt, và SHALL không upload object S3 cũng như không tạo document row mới.
12. IF `Storage_Only_Ingest` không hoàn tất trong 900 giây, THEN THE Ingest_Pipeline SHALL hủy tác vụ và đặt `Document_Status` thành `failed` kèm `error_message` tiếng Việt nêu rõ quá trình xử lý đã vượt giới hạn thời gian.
13. IF endpoint list document nhận giá trị `status` không thuộc tập `processing`, `stored`, `ready`, `failed`, `ocr_required`, THEN THE Documents_Endpoint SHALL từ chối request với mã lỗi `invalid_status` kèm thông báo tiếng Việt và SHALL không trả về danh sách document.

### Requirement 4: Readiness và observability phản ánh AI_Disabled_Mode

**User Story:** Là người vận hành, tôi muốn `Readiness_Endpoint` báo ready khi AI đang tắt, để container không bị coi là không sẵn sàng chỉ vì thiếu cấu hình Dify hoặc embedding.

#### Acceptance Criteria

1. WHILE hệ thống ở `AI_Disabled_Mode`, WHEN `Readiness_Endpoint` được gọi và kiểm tra kết nối database thành công cùng kiểm tra truy cập bucket storage thành công, THE Readiness_Endpoint SHALL trả về `status` bằng `ready` trong vòng 5 giây kể từ khi nhận request.
2. WHILE hệ thống ở `AI_Disabled_Mode`, WHEN `Readiness_Endpoint` được gọi, THE Readiness_Endpoint SHALL tính `status` chỉ từ ba kết quả kiểm tra `database`, `storage_configured` và `storage_reachable`, loại `dify_configured` và `embedding_configured` khỏi phép tính.
3. WHEN `GET /api/v1/ready` hoặc `GET /ready` được gọi ở `AI_Disabled_Mode` hoặc `AI_Enabled_Mode`, THE Readiness_Endpoint SHALL trả về `Feature_Status_Field` với giá trị boolean bằng đúng giá trị hiện tại của `AI_Feature_Flag` trong tiến trình đang phục vụ request.
4. WHILE hệ thống ở `AI_Enabled_Mode`, WHEN `Readiness_Endpoint` được gọi, THE Readiness_Endpoint SHALL chỉ trả về `status` bằng `ready` khi cả năm kết quả kiểm tra `database`, `storage_configured`, `storage_reachable`, `dify_configured` và `embedding_configured` đều bằng `true`.
5. WHEN `GET /api/v1/health` được gọi ở `AI_Disabled_Mode` hoặc `AI_Enabled_Mode`, THE Health_Endpoint SHALL trả về response với đúng tập trường và giá trị như trước thay đổi này, không bổ sung `Feature_Status_Field` và không phụ thuộc `AI_Feature_Flag`.
6. WHEN ứng dụng hoàn tất lifespan startup, THE FastAPI_Application SHALL ghi đúng một log entry ở mức INFO chứa giá trị boolean hiện tại của `AI_Feature_Flag`, một lần cho mỗi lần khởi động tiến trình.
7. WHEN hệ thống ghi bất kỳ log entry nào liên quan tới `AI_Feature_Flag`, `Readiness_Endpoint` hoặc `Storage_Only_Ingest`, THE Backend_Application SHALL không ghi bearer token, API key, credential, presigned URL hoặc nội dung văn bản trích từ PDF.
8. IF hệ thống ở `AI_Disabled_Mode` và kiểm tra kết nối database thất bại hoặc kiểm tra truy cập bucket storage thất bại, THEN THE Readiness_Endpoint SHALL trả về `status` bằng `not_ready` kèm thông báo tiếng Việt cho biết có dependency chưa sẵn sàng, và SHALL không thay đổi dữ liệu nào trong database hoặc storage.
9. IF `DifyClient` hoặc `EmbeddingService` chưa được khởi tạo khi `Readiness_Endpoint` được gọi, THEN THE Readiness_Endpoint SHALL trả về `dify_configured` và `embedding_configured` bằng `false` và SHALL hoàn tất response mà không phát sinh lỗi chưa được xử lý.
10. WHILE hệ thống ở `AI_Disabled_Mode`, WHEN `Readiness_Endpoint` được gọi, THE Readiness_Endpoint SHALL không phát ra request mạng nào tới Dify và không tải model embedding.

### Requirement 5: Frontend hiển thị Chat_Placeholder và giữ nguyên phần còn lại

**User Story:** Là học sinh, tôi muốn giao diện nói rõ tính năng hỏi đáp AI đang tạm ngưng bằng tiếng Việt, để tôi tiếp tục dùng thư viện tài liệu mà không bị bối rối.

#### Acceptance Criteria

1. WHILE `Feature_Status_Field` có giá trị `false`, WHEN người dùng đã xác thực truy cập route `/chat`, THE Frontend_Application SHALL hiển thị `Chat_Placeholder` trong vòng 1 giây kể từ lúc `Feature_Status_Field` được xác định, gồm một tiêu đề tiếng Việt nêu rõ tính năng hỏi đáp AI đang tạm ngưng và một đoạn mô tả tiếng Việt dài tối đa 300 ký tự hướng dẫn người dùng tiếp tục sử dụng thư viện tài liệu.
2. WHILE `Feature_Status_Field` có giá trị `false`, WHEN route `/chat` được hiển thị, THE Frontend_Application SHALL không render ô nhập câu hỏi, không render nút gửi, không render bộ chọn tài liệu và SHALL phát ra 0 request tới `Chat_Endpoint` thông qua `api.streamChat`.
3. WHILE `Feature_Status_Field` có giá trị `false`, WHEN route `/chat` được hiển thị, THE Frontend_Application SHALL phát ra 0 request tới `Conversation_Endpoints`, bao gồm các thao tác liệt kê, tạo, đổi tên và xóa hội thoại.
4. WHILE `Feature_Status_Field` có giá trị `false`, WHEN `Chat_Placeholder` được hiển thị, THE Chat_Placeholder SHALL cung cấp đúng một liên kết trỏ tới route `/library` với nhãn tiếng Việt mô tả hành động mở thư viện tài liệu và liên kết đó SHALL nhận được focus bằng bàn phím.
5. WHILE `Feature_Status_Field` có giá trị `false`, THE Sidebar SHALL hiển thị mục điều hướng "Hỏi đáp AI" kèm nhãn tiếng Việt cho biết tính năng tạm ngưng, và mục đó SHALL được đánh dấu là vô hiệu hóa cho công nghệ trợ giúp.
6. WHILE `Feature_Status_Field` có giá trị `false`, THE DashboardPage SHALL render 0 liên kết trỏ tới route `/chat` và render đúng hai liên kết trỏ tới route `/library`, mỗi liên kết kèm nhãn tiếng Việt mô tả hành động mở thư viện tài liệu.
7. WHILE `Feature_Status_Field` có giá trị `true`, WHEN người dùng đã xác thực truy cập route `/chat`, THE Frontend_Application SHALL hiển thị `ChatPage` với danh sách hội thoại, ô nhập câu hỏi, nút gửi và hành vi streaming SSE hiện có, và SHALL không hiển thị `Chat_Placeholder`.
8. THE Frontend_Application SHALL lấy `Feature_Status_Field` thông qua một hàm duy nhất của `API_Client`, SHALL phát ra tối đa 1 request tới `Readiness_Endpoint` cho mỗi lần tải ứng dụng, và SHALL không gọi `fetch` trực tiếp từ bất kỳ component hoặc page nào.
9. THE Frontend_Codebase SHALL giữ nguyên các file component `ChatPanel`, `MessageBubble`, `CitationCard`, `ConversationList` và hook `useConversations` trong repository với 0 file bị xóa, và các file này SHALL biên dịch không phát sinh lỗi kiểu TypeScript.
10. WHILE `Feature_Status_Field` chưa được xác định, WHEN route `/chat` được hiển thị, THE Frontend_Application SHALL hiển thị chỉ báo đang tải, SHALL không render ô nhập câu hỏi và nút gửi, và SHALL phát ra 0 request tới `Chat_Endpoint` và `Conversation_Endpoints`.
11. IF việc đọc `Feature_Status_Field` thất bại do lỗi mạng, response không hợp lệ, giá trị không phải boolean, hoặc không có response trong vòng 5 giây, THEN THE Frontend_Application SHALL coi `Feature_Status_Field` là `false`, hiển thị `Chat_Placeholder` kèm thông báo tiếng Việt cho biết không xác định được trạng thái tính năng, và SHALL không phát ra request nào tới `Chat_Endpoint`.
12. WHEN `npm --prefix frontend run build` được chạy, THE Frontend_Build SHALL kết thúc với exit code 0 và 0 lỗi kiểm tra kiểu TypeScript.
13. WHILE `Feature_Status_Field` có giá trị `false`, WHEN người dùng kích hoạt liên kết trong `Chat_Placeholder` bằng chuột hoặc bàn phím, THE Frontend_Application SHALL chuyển route hiện tại thành `/library` bằng điều hướng React Router mà không tải lại toàn trang.
14. WHILE `Feature_Status_Field` có giá trị `false`, IF người dùng kích hoạt mục điều hướng "Hỏi đáp AI" trong `Sidebar`, THEN THE Frontend_Application SHALL giữ nguyên route hiện tại và SHALL không phát ra request nào tới `Chat_Endpoint` hoặc `Conversation_Endpoints`.
15. WHILE `Feature_Status_Field` có giá trị `false`, WHEN người dùng đã xác thực mở route `/chat` bằng liên kết trực tiếp hoặc tải lại trang, THE Frontend_Application SHALL giữ đường dẫn hiện tại là `/chat` và hiển thị `Chat_Placeholder` mà không tự động chuyển hướng sang route khác.

### Requirement 6: Giảm ML_Dependencies và kích thước Runtime_Image

**User Story:** Là người vận hành trên EC2 2 GiB, tôi muốn image và bộ nhớ runtime nhỏ hơn đáng kể, để triển khai nhanh và ổn định hơn trong lúc AI tạm ngưng.

#### Acceptance Criteria

1. THE Runtime_Requirements SHALL loại `torch`, `sentence-transformers`, `transformers` và `numpy` khỏi tập dependency được cài vào `Runtime_Image`, sao cho không package nào trong bốn package này xuất hiện trong danh sách package đã cài của `Runtime_Image`, kể cả dưới dạng dependency gián tiếp.
2. THE Runtime_Requirements SHALL giữ `PyMuPDF` với phiên bản được ghim để hỗ trợ parse PDF, và `Runtime_Image` SHALL import được `PyMuPDF` thành công sau khi build.
3. THE Backend_Requirements SHALL khai báo `torch`, `sentence-transformers`, `transformers` và `numpy` cùng mọi chỉ thị index bổ sung mà chúng cần trong một tập dependency tùy chọn riêng biệt được lưu trong mã nguồn, để việc bật lại `AI_Enabled_Mode` chỉ cần cài tập dependency tùy chọn đó, không cần khôi phục thủ công từ lịch sử git.
4. THE Dockerfile SHALL không chứa bước tải model embedding lúc build ở cấu hình `AI_Disabled_Mode`, sao cho quá trình build hoàn tất mà không tải bất kỳ file weight model nào.
5. THE Dockerfile SHALL không khai báo các biến môi trường cache model embedding (`HF_HOME`, `SENTENCE_TRANSFORMERS_HOME`) và không tạo thư mục cache model tương ứng khi các dependency AI không được cài.
6. WHEN `Runtime_Image` được build ở cấu hình `AI_Disabled_Mode` trên cùng kiến trúc CPU và cùng base image với baseline, THE Runtime_Image SHALL có kích thước uncompressed nhỏ hơn hoặc bằng 50 phần trăm baseline, trong đó baseline là kích thước uncompressed của image build từ `Dockerfile` trước thay đổi, được đo và ghi lại một lần bằng cùng công cụ đo, và kích thước tuyệt đối SHALL không vượt 800 MiB.
7. WHEN ứng dụng khởi động ở `AI_Disabled_Mode`, THE Backend_Application SHALL hoàn tất startup trong vòng 30 giây và SHALL không có `torch`, `sentence_transformers`, `transformers` hoặc `numpy` trong tập module đã được import khi startup kết thúc.
8. IF một module AI được import trong khi các dependency tương ứng chưa được cài, THEN THE Backend_Application SHALL trả về lỗi import có thông điệp nêu rõ tên tập dependency AI tùy chọn cần cài, SHALL không làm dừng tiến trình đang chạy, và SHALL giữ các endpoint không phụ thuộc AI tiếp tục phục vụ bình thường.
9. THE Backend_Requirements SHALL ghim phiên bản chính xác bằng toán tử `==` cho mọi dependency được khai báo ở cả tập runtime và tập tùy chọn, và SHALL không dùng khoảng phiên bản mở hoặc dependency không ghim.
10. WHEN các dependency runtime được nâng version, THE Backend_Test_Suite SHALL chạy trọn bộ pytest với 0 test thất bại và 0 lỗi thu thập, trong môi trường không cài `torch`, `sentence-transformers`, `transformers` và `numpy`.
11. WHILE `Backend_Application` chạy ở `AI_Disabled_Mode` và ở trạng thái idle sau khi startup hoàn tất, THE Backend_Application SHALL duy trì resident memory không vượt 512 MiB.
12. IF quá trình kiểm tra `Runtime_Image` build ở `AI_Disabled_Mode` phát hiện `torch`, `sentence-transformers`, `transformers` hoặc `numpy` đã được cài, THEN THE Build_Pipeline SHALL kết thúc thất bại với thông điệp nêu rõ tên các package vi phạm và SHALL không publish image đó.
13. WHEN tập dependency AI tùy chọn được cài để bật `AI_Enabled_Mode`, THE Backend_Application SHALL hoàn tất startup thành công mà không cần thay đổi mã nguồn hoặc `Dockerfile`.

### Requirement 7: Bảo toàn schema và dữ liệu đã lập chỉ mục

**User Story:** Là học sinh đã có tài liệu được lập chỉ mục, tôi muốn dữ liệu chunk và lịch sử hội thoại được giữ nguyên, để khi tính năng AI bật lại tôi không phải upload lại tài liệu.

#### Acceptance Criteria

1. THE Database_Schema SHALL giữ bảng `document_chunks` cùng toàn bộ cột hiện có (`id`, `document_id`, `content`, `embedding` kiểu vector 768 chiều, `metadata`, `content_tsv` là cột tsvector sinh tự động và lưu trữ, `created_at`) và giữ 3 index `idx_chunks_doc`, `idx_chunks_tsv`, `idx_chunks_vec` với cùng kiểu index và cùng tham số như trước khi nâng cấp, không xóa hoặc đổi tên bất kỳ cột hay index nào trong số đó.
2. THE Database_Schema SHALL giữ bảng `conversations` và bảng `messages` cùng toàn bộ cột hiện có, trong đó `dify_conversation_id`, `citations`, `latency_ms`, `dify_message_id` giữ nguyên tên, kiểu dữ liệu, giá trị mặc định và tính cho phép NULL như trước khi nâng cấp.
3. THE Database_Schema SHALL giữ extension `vector` và `unaccent` trong schema `extensions` cùng hàm `public.immutable_unaccent` với thuộc tính IMMUTABLE, sao cho lời gọi hàm này trả về đúng kết quả như trước khi nâng cấp.
4. WHEN một migration mới bổ sung giá trị `stored` vào ràng buộc CHECK của `documents.status`, THE Migration_Set SHALL giữ nguyên 4 giá trị hiện có (`processing`, `ready`, `failed`, `ocr_required`), cho phép ghi giá trị `stored` thành công, và từ chối mọi giá trị nằm ngoài tập 5 giá trị này.
5. WHEN một file migration mới được thêm dưới `supabase/migrations/`, THE Migration_Set SHALL tạo file tương ứng dưới `backend/app/db/migrations/` có cùng tên file và nội dung SQL giống hệt (0 dòng khác biệt khi so sánh nội dung hai file).
6. THE Migration_Set SHALL giữ Row Level Security ở trạng thái bật trên `documents`, `document_chunks`, `conversations`, `messages` và giữ 4 policy `owner_documents`, `owner_chunks`, `owner_conversations`, `owner_messages` với cùng biểu thức điều kiện, sao cho truy vấn của người dùng không phải chủ sở hữu trả về 0 row.
7. WHEN migration mới được áp dụng lên database đã có dữ liệu, THE Migration_Set SHALL giữ số row của `documents`, `document_chunks`, `conversations`, `messages` không thay đổi (chênh lệch bằng 0 so với trước khi áp dụng) và giữ mọi row hiện có đọc được với `id`, `content`, `embedding` và `citations` không thay đổi.
8. THE Repository_Layer SHALL giữ phương thức `vector_search` và `lexical_search` của `ChunkRepository` với tên và chữ ký (danh sách tham số, kiểu trả về) không thay đổi, và mỗi truy vấn của hai phương thức này SHALL chứa điều kiện giới hạn theo `Owner_Scope` của người dùng đã xác thực, để dùng lại khi bật `AI_Enabled_Mode`.
9. IF việc áp dụng một migration mới thất bại ở bất kỳ câu lệnh nào, THEN THE Migration_Set SHALL hoàn tác toàn bộ thay đổi của migration đó trong cùng một transaction, giữ schema và toàn bộ row ở trạng thái trước khi áp dụng, và báo lỗi nêu rõ câu lệnh gây thất bại.
10. WHILE hệ thống không ở `AI_Enabled_Mode`, THE Backend SHALL không phát sinh lệnh xóa hoặc ghi đè nào lên `document_chunks`, `conversations`, `messages`, ngoại trừ xóa cascade do người dùng chủ động xóa tài liệu hoặc hội thoại của chính mình.

### Requirement 8: Bảo toàn Owner_Scope, xác thực và test

**User Story:** Là người dùng và người vận hành, tôi muốn việc tắt AI không làm suy giảm cách ly dữ liệu giữa người dùng và không làm mất khả năng kiểm chứng bằng test.

#### Acceptance Criteria

1. WHEN bất kỳ endpoint document, conversation hoặc chat nào được gọi kèm bearer token Supabase hợp lệ và chưa hết hạn, THE Backend_Application SHALL phân giải `owner_id` từ token đó và xử lý request trong `Owner_Scope` của `owner_id` này.
2. THE Repository_Layer SHALL áp dụng điều kiện `owner_id` tường minh trong mọi câu lệnh đọc, thêm, sửa và xóa trên các bảng `documents`, `document_chunks`, `conversations` và `messages`, không có ngoại lệ.
3. WHEN người dùng A yêu cầu đọc, sửa hoặc xóa một document, conversation hoặc message thuộc người dùng B, THE Backend_Application SHALL trả về HTTP status 404, SHALL không đưa bất kỳ trường dữ liệu nào của người dùng B vào response, và SHALL không thay đổi dữ liệu của người dùng B.
4. WHILE hệ thống ở `AI_Disabled_Mode`, WHEN `python -m pytest backend/tests -q` được chạy, THE Backend_Test_Suite SHALL kết thúc với exit code 0, với 0 test thất bại và 0 lỗi thu thập test, trong tối đa 300 giây.
5. WHERE một test phụ thuộc embedding, retrieval hoặc Dify, THE Backend_Test_Suite SHALL đánh dấu test đó là skipped bằng cơ chế skip có điều kiện dựa trên `AI_Feature_Flag` hoặc sự hiện diện của `ML_Dependencies`, với lý do skip là văn bản dài từ 10 đến 200 ký tự nêu rõ flag hoặc dependency còn thiếu.
6. IF `ML_Dependencies` chưa được cài trong môi trường chạy test, THEN THE Backend_Test_Suite SHALL hoàn tất giai đoạn thu thập test không có lỗi import và SHALL báo các test phụ thuộc AI ở trạng thái skipped thay vì failed hoặc error.
7. THE Backend_Test_Suite SHALL bao gồm ít nhất một test cho `Chat_Endpoint` ở `AI_Disabled_Mode` xác nhận đồng thời HTTP status 503, mã lỗi `ai_features_disabled`, số row thêm vào bảng `messages` bằng 0 và số lần gọi fake Dify bằng 0.
8. THE Backend_Test_Suite SHALL bao gồm ít nhất một test cho `Storage_Only_Ingest` xác nhận đồng thời `Document_Status` bằng `stored`, `chunk_count` bằng 0, số thao tác ghi trên bảng `document_chunks` bằng 0 và số lần gọi fake embedding service bằng 0.
9. THE Backend_Test_Suite SHALL bao gồm ít nhất một test cho `Readiness_Endpoint` xác nhận `status` bằng `ready` và `Feature_Status_Field` bằng `false` ở `AI_Disabled_Mode` khi Dify và embedding chưa được cấu hình, trong khi database và storage fake truy cập được.
10. WHEN `python -m pytest backend/tests -q` được chạy mà không có credential Supabase, S3, Dify và không có endpoint embedding thật khả dụng, THE Backend_Test_Suite SHALL hoàn tất với exit code 0 bằng cách dùng fake cho toàn bộ bốn phụ thuộc này.
11. WHEN `make lint` được chạy, THE Repository SHALL hoàn tất kiểm tra compile Python và kiểm tra kiểu TypeScript với exit code 0 và 0 lỗi được báo.
12. IF một request tới endpoint document, conversation hoặc chat không kèm bearer token, kèm token sai định dạng, hoặc kèm token đã hết hạn, THEN THE Backend_Application SHALL trả về HTTP status 401 kèm thông báo cho biết yêu cầu chưa được xác thực, và SHALL không thực hiện truy vấn hoặc cập nhật dữ liệu nào.
13. WHILE hệ thống ở `AI_Enabled_Mode` và `ML_Dependencies` đã được cài, WHEN `python -m pytest backend/tests -q` được chạy, THE Backend_Test_Suite SHALL thực thi các test phụ thuộc embedding, retrieval và Dify thay vì skip, với 0 test thất bại.

### Requirement 9: Đồng bộ tài liệu và spec liên quan

**User Story:** Là thành viên nhóm phát triển, tôi muốn tài liệu và các spec khác phản ánh đúng trạng thái AI đang tạm ngưng, để không ai triển khai theo giả định đã lỗi thời.

#### Acceptance Criteria

1. WHEN thay đổi tắt tính năng AI được áp dụng vào repository, THE Repository_Documentation SHALL ghi trong `README.md` một mục nêu đủ bốn thông tin: tính năng AI đang tạm ngưng, tên biến `AI_FEATURES_ENABLED` cùng giá trị mặc định `false`, giá trị cần đặt để bật lại `AI_Enabled_Mode`, và tên tập dependency AI tùy chọn cần cài trước khi bật lại.
2. THE Repository_Documentation SHALL ghi trong `README.md` đủ năm giá trị `Document_Status` (`processing`, `stored`, `ready`, `failed`, `ocr_required`), trong đó nêu rõ `Indexed_Status` `stored` là tài liệu đã lưu trữ với `chunk_count` bằng 0 và chưa lập chỉ mục nên không tham gia truy hồi, khác với `ready` là đã lập chỉ mục và tham gia truy hồi.
3. WHEN nội dung `.kiro/specs/ingest-reliability-and-performance/tasks.md` được cập nhật theo thay đổi này, THE Spec_Set SHALL đặt `status` của đúng sáu task `IRP-003`, `IRP-004`, `IRP-008`, `IRP-009`, `IRP-013`, `IRP-014` thành `deferred`, mỗi task kèm một dòng lý do nêu rõ task phụ thuộc embedding hoặc chunker và không còn căn cứ trong thời gian `AI_Disabled_Mode` có hiệu lực.
4. THE Spec_Set SHALL giữ `status` `pending` cho đúng chín task không phải gate `IRP-001`, `IRP-002`, `IRP-005`, `IRP-006`, `IRP-007`, `IRP-010`, `IRP-011`, `IRP-012`, `IRP-015` vì các task này không phụ thuộc embedding hoặc chunker, và SHALL giữ `status` `pending` cho cả hai task gate `IRP-016` và `IRP-017`, sao cho tổng số task ở `status` `pending` bằng mười một và tổng số task ở `status` `deferred` bằng sáu, cộng lại bằng mười bảy task.
5. WHEN nội dung `.kiro/specs/ingest-reliability-and-performance/tasks.md` được cập nhật, THE Spec_Set SHALL giữ nguyên toàn bộ 17 ID hiện có từ `IRP-001` đến `IRP-017`, không xóa ID, không đánh số lại và không đổi sang định dạng khác `IRP-NNN`.
6. WHEN thay đổi tắt tính năng AI được áp dụng vào repository, THE Deployment_Documentation SHALL ghi dưới `deploy/` đủ bốn nội dung: lệnh build `Runtime_Image` ở `AI_Disabled_Mode`, lệnh chạy container, giá trị `AI_FEATURES_ENABLED` cần đặt, và cách xác minh bằng `Readiness_Endpoint` trả về `status` bằng `ready` cùng `Feature_Status_Field` bằng `false`.
7. THE Spec_Set SHALL gán cho mỗi ID trong 17 ID `IRP-NNN` đúng một `status` thuộc tập `pending` hoặc `deferred`, không để ID nào thiếu `status` và không để ID nào mang nhiều hơn một `status`, và SHALL kèm một dòng lý do cho mỗi task ở `status` `deferred`.
8. IF một task ở `status` `pending` có `dependencies` trỏ tới một task ở `status` `deferred`, THEN THE Spec_Set SHALL ghi kèm task đó một ghi chú nêu rõ task chỉ thực thi được sau khi `AI_Enabled_Mode` được bật lại hoặc sau khi dependency bị hoãn được loại khỏi danh sách `dependencies`, và SHALL không để lại dependency không thể thỏa mãn mà thiếu ghi chú.
9. WHEN `AI_Feature_Flag` được đặt thành `true` và tập dependency AI tùy chọn được cài, THE Spec_Set SHALL đưa `status` của các task `deferred` trở lại `pending` và SHALL giữ nguyên ID, mục tiêu và tiêu chí acceptance hiện có của các task đó.

## Non-Functional Requirements

1. **Hiệu năng:** WHEN ứng dụng chạy ở `AI_Disabled_Mode`, THE Backend_Application SHALL duy trì mức sử dụng RSS thấp hơn mức đo được ở `AI_Enabled_Mode` trên cùng khối lượng công việc upload, và ở trạng thái idle sau startup SHALL không vượt 512 MiB theo Yêu cầu 6 tiêu chí 11.
2. **Khả năng hoàn nguyên:** WHEN `AI_FEATURES_ENABLED` được đặt thành `true` và tập dependency AI tùy chọn được cài, THE Backend_Application SHALL phục hồi hành vi chat và ingest có lập chỉ mục mà không cần thay đổi code.
3. **Tương thích:** THE Backend_API SHALL giữ nguyên route, phương thức và schema response hiện có, ngoại trừ việc bổ sung `Feature_Status_Field`, giá trị `Indexed_Status` `stored` và mã lỗi `ai_features_disabled`.
4. **Bảo mật:** THE Repository SHALL không commit `.env`, service-role key, secret Dify hoặc AWS, và PDF của người dùng; chỉ các giá trị công khai có tiền tố `VITE_` được đưa vào cấu hình trình duyệt.
5. **Ngôn ngữ:** THE User_Facing_Copy SHALL giữ tiếng Việt cho mọi thông báo lỗi và nội dung giao diện mới.
6. **Kiến trúc:** THE Backend_Codebase SHALL giữ SQL trong `db/repositories/`, tích hợp bên ngoài trong `services/`, hợp đồng wire trong `schemas/`, và giữ route ở mức validation cùng orchestration.
7. **Khả năng kiểm chứng:** THE Acceptance_Criteria SHALL có thể kiểm chứng bằng pytest với fake, kiểm tra build frontend, hoặc phép đo kích thước image và mức bộ nhớ.

## Ngoài phạm vi

- Xây dựng pipeline OCR cho PDF chỉ có ảnh.
- Thay đổi model embedding hoặc nhà cung cấp sinh câu trả lời.
- Drop bảng `document_chunks`, `conversations`, `messages` hoặc các index pgvector và full-text.
- Thay Dify bằng một provider LLM khác.
- Chuyển ingest sang worker riêng hoặc message queue.
- Nâng cấp hạ tầng vượt môi trường EC2 2 GiB hiện tại.
- Thay đổi cơ chế xác thực Supabase hoặc nới lỏng policy RLS.
- Thực thi các task còn hiệu lực của spec `ingest-reliability-and-performance`.
