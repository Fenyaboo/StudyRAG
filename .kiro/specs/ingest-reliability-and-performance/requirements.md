# Ingest Reliability and Performance — Requirements

## 1. Giới thiệu

Tài liệu này đặc tả các yêu cầu sửa lỗi và tăng độ tin cậy cho luồng ingest tài liệu, đồng thời giữ ổn định hành vi API hiện có trong môi trường EC2 2 GiB. Phạm vi tập trung vào sáu hành vi đã được xác minh: đồng nhất định danh tài liệu giữa lúc tạo và background ingest; phục hồi tài liệu không bị kẹt ở trạng thái `processing`; dùng nhất quán cache model/tokenizer; giảm chi phí tokenize khi chunking; kiểm tra readiness bằng kết nối S3 thật; và bảo toàn scoping theo owner, tương thích ngược API, bảo mật log cùng mức sử dụng bộ nhớ hiện tại.

Bằng chứng hiện có gồm: cột `documents.id` có mặc định `gen_random_uuid()` nhưng thao tác create không insert `id`; log production ghi `ValueError: Document does not belong to owner`; có các row production ở trạng thái `processing`/`error` với giá trị `NULL`; container đang healthy và không có OOM; tồn tại hai đường dẫn cache `/opt/huggingface/models--...` và `/opt/huggingface/hub/models--...`; và `storage.check` đã tồn tại nhưng endpoint `/ready` hiện chỉ kiểm tra dạng boolean `bucket` thay vì kiểm tra S3 thật.

## 2. Requirements

### 2.1. Nhất quán document_id trong create và background ingest

**User Story:** Là người dùng tải tài liệu lên, tôi muốn bản ghi tài liệu được tạo và background ingest sử dụng cùng một `document_id`, để tài liệu được xử lý đúng owner mà không phát sinh lỗi `Document does not belong to owner`.

**Acceptance Criteria (EARS):**

2.1.1 WHEN hệ thống tạo một document mới THEN hệ thống SHALL sinh hoặc xác định một `document_id` duy nhất trước khi tạo background ingest và SHALL lưu chính document_id đó vào bản ghi document.

2.1.2 WHEN background ingest bắt đầu xử lý document đã tạo THEN hệ thống SHALL sử dụng đúng `document_id` của bản ghi document tương ứng, không tự sinh hoặc suy ra một định danh khác.

2.1.3 WHEN background ingest truy cập document theo owner THEN hệ thống SHALL xác thực quyền sở hữu trên cùng cặp `document_id` và `owner_id` đã được dùng khi create, và SHALL không báo lỗi `Document does not belong to owner` chỉ vì định danh bị lệch.

2.1.4 IF thao tác tạo document hoặc khởi tạo background ingest thất bại THEN hệ thống SHALL không để lại một job tham chiếu tới document_id không tồn tại hoặc không khớp với bản ghi document.

### 2.2. Timeout, recovery và observability cho ingest/status

**User Story:** Là người vận hành và người dùng theo dõi ingest, tôi muốn mọi tài liệu đang xử lý được kết thúc hoặc phục hồi có kiểm soát, để không bị kẹt vô hạn ở `processing` và có đủ thông tin điều tra lỗi.

**Acceptance Criteria (EARS):**

2.2.1 WHILE một document ở trạng thái `processing` THEN hệ thống SHALL áp dụng timeout hữu hạn cho toàn bộ công việc ingest và SHALL chuyển document khỏi trạng thái `processing` khi timeout xảy ra.

2.2.2 WHEN ingest timeout hoặc gặp lỗi không thể tiếp tục THEN hệ thống SHALL ghi nhận trạng thái lỗi có thể quan sát được, thông báo lỗi an toàn cho API/status và SHALL không để document bị kẹt vô hạn ở `processing`.

2.2.3 WHEN background ingest bị gián đoạn trước khi cập nhật trạng thái cuối THEN cơ chế recovery SHALL phát hiện và xử lý các document stale trong thời gian hữu hạn bằng retry có giới hạn hoặc chuyển sang `error` theo chính sách xác định.

2.2.4 WHEN endpoint update/status đọc trạng thái document THEN hệ thống SHALL trả về trạng thái phản ánh kết quả thực tế (`processing`, hoàn tất hoặc `error`) và SHALL xử lý rõ các row có giá trị trạng thái/lỗi `NULL` mà không làm kẹt hoặc làm hỏng luồng theo dõi.

2.2.5 WHEN ingest bắt đầu, kết thúc, timeout, retry hoặc chuyển sang `error` THEN hệ thống SHALL phát ra log/metric có correlation/document identifier phù hợp, thời điểm và trạng thái chuyển đổi, nhưng SHALL không ghi secret hoặc dữ liệu nhạy cảm.

2.2.6 IF recovery xử lý lại một document THEN hệ thống SHALL bảo đảm thao tác cập nhật trạng thái là an toàn khi retry và SHALL không tạo ra kết quả cuối mâu thuẫn do nhiều lần xử lý.

### 2.3. Nhất quán cache model/tokenizer giữa build và runtime

**User Story:** Là người triển khai dịch vụ, tôi muốn build và runtime dùng cùng một layout cache model/tokenizer, để runtime không tải lại hoặc không tìm thấy model đã được chuẩn bị trong image.

**Acceptance Criteria (EARS):**

2.3.1 WHEN image được build với model/tokenizer được cache trước THEN hệ thống SHALL ghi cache vào đúng layout và biến môi trường mà runtime sử dụng.

2.3.2 WHEN container khởi động trong môi trường không có mạng hoặc mạng hạn chế THEN runtime SHALL tìm thấy và nạp model/tokenizer từ cùng cache đã được build, không phụ thuộc vào việc tồn tại đồng thời hai layout `/opt/huggingface/models--...` và `/opt/huggingface/hub/models--...`.

2.3.3 WHEN model/tokenizer được nạp ở build hoặc runtime THEN hệ thống SHALL dùng cùng định danh model, thư mục cache và cơ chế resolve; việc nạp thiếu cache SHALL tạo lỗi quan sát được thay vì âm thầm dùng một cache khác hoặc tải lặp ngoài dự kiến.

2.3.4 IF cache hợp lệ đã tồn tại THEN runtime SHALL không tạo bản sao cache trùng lặp chỉ do build và runtime cấu hình khác nhau.

### 2.4. Chunking hiệu quả và giữ nguyên hợp đồng dữ liệu

**User Story:** Là hệ thống ingest, tôi muốn chunking thực hiện tokenize hiệu quả, để giảm chi phí CPU/bộ nhớ nhưng vẫn giữ giới hạn và metadata hiện có.

**Acceptance Criteria (EARS):**

2.4.1 WHEN hệ thống chia văn bản thành chunks THEN hệ thống SHALL tránh việc tokenize lặp theo bậc hai hoặc tokenize lại cùng một đoạn không cần thiết, và SHALL có chi phí tăng tuyến tính theo kích thước đầu vào trong quy trình chunking.

2.4.2 WHEN hệ thống tạo chunks THEN mỗi chunk SHALL tuân thủ `max_tokens=220`.

2.4.3 WHEN các chunks liên tiếp được tạo THEN hệ thống SHALL giữ `overlap=32` theo đơn vị token, trừ trường hợp đoạn cuối hoặc đầu vào ngắn hơn không thể đáp ứng đầy đủ overlap.

2.4.4 WHEN hệ thống trả về chunks sau ingest THEN hệ thống SHALL bảo toàn metadata gắn với nguồn/chunk và SHALL tạo id ổn định, duy nhất trong phạm vi tài liệu theo hợp đồng hiện có.

2.4.5 IF đầu vào rỗng, ngắn hơn giới hạn hoặc có ký tự Unicode hợp lệ THEN chunking SHALL xử lý hữu hạn, không tokenize lặp vô hạn, không làm mất metadata/id và không vượt `max_tokens=220`.

### 2.5. Readiness kiểm tra S3 thật, healthcheck không đổi

**User Story:** Là hệ thống triển khai và người vận hành, tôi muốn `/ready` phản ánh khả năng truy cập storage thật, để traffic chỉ được gửi tới instance có thể dùng S3; đồng thời healthcheck hiện tại phải tiếp tục giữ nguyên mục đích và hành vi.

**Acceptance Criteria (EARS):**

2.5.1 WHEN endpoint `/ready` được gọi THEN hệ thống SHALL thực hiện kiểm tra storage/S3 thật thông qua cơ chế kiểm tra hiện có và SHALL chỉ báo ready khi bucket/configuration cần thiết có thể được truy cập.

2.5.2 WHEN S3 không thể truy cập, bucket không hợp lệ hoặc credentials/configuration không dùng được THEN `/ready` SHALL trả trạng thái không sẵn sàng phù hợp và SHALL không trả ready chỉ vì biến `bucket` có giá trị boolean.

2.5.3 WHILE `/ready` liên tiếp được gọi trong khoảng thời gian ngắn THEN hệ thống SHALL cache kết quả kiểm tra S3 trong một khoảng thời gian ngắn có giới hạn, để giảm request/thời gian phụ thuộc S3 mà vẫn nhanh chóng phản ánh lỗi mới.

2.5.4 IF cache readiness hết hạn THEN lần kiểm tra kế tiếp SHALL thực hiện lại kiểm tra S3 thật và cập nhật kết quả thành công/thất bại tương ứng.

2.5.5 WHEN healthcheck hiện tại của container được chạy THEN hệ thống SHALL CONTINUE TO sử dụng endpoint/cơ chế healthcheck hiện có, không đổi mục tiêu hoặc làm suy giảm kiểm tra liveness hiện tại.

### 2.6. Bảo toàn isolation, tương thích API, bảo mật log và giới hạn tài nguyên

**User Story:** Là người dùng API và người vận hành, tôi muốn bản sửa không phá vỡ isolation hoặc hợp đồng API hiện có, không làm lộ secret và vẫn chạy ổn định trên EC2 2 GiB.

**Acceptance Criteria (EARS):**

2.6.1 WHEN bất kỳ document hoặc status nào được truy cập THEN hệ thống SHALL CONTINUE TO áp dụng `owner_id` scoping cho đọc, cập nhật, ingest và recovery, và SHALL không cho owner này nhìn thấy hoặc sửa dữ liệu của owner khác.

2.6.2 WHEN client gọi các endpoint hiện có với request/response hợp lệ THEN hệ thống SHALL CONTINUE TO giữ tương thích ngược về route, phương thức, schema và ý nghĩa các response hiện có, ngoại trừ việc sửa các trạng thái lỗi/kẹt được nêu trong tài liệu này.

2.6.3 WHEN hệ thống ghi log, metric, exception hoặc thông tin observability THEN hệ thống SHALL không ghi token, password, secret key, credentials, authorization header hoặc nội dung nhạy cảm không cần thiết.

2.6.4 WHILE dịch vụ chạy trên EC2 có 2 GiB RAM THEN hệ thống SHALL duy trì giới hạn sử dụng bộ nhớ phù hợp, không yêu cầu worker/message queue riêng và không tạo tải cache/model/chunking làm container OOM.

2.6.5 WHEN container khởi động và xử lý ingest bình thường THEN hệ thống SHALL CONTINUE TO duy trì trạng thái vận hành healthy, không làm suy giảm các kiểm tra liveness hiện có.

## 3. Non-Functional Requirements (NFR)

3.1. **Hiệu năng:** Luồng chunking SHALL tránh tokenize bậc hai; các thay đổi readiness SHALL dùng cache ngắn có TTL hữu hạn; các thao tác mới không được tạo request S3 ở mọi lần gọi liên tiếp trong TTL.

3.2. **Độ tin cậy:** Mọi document ingest phải có đường chuyển trạng thái hữu hạn và có recovery cho job bị gián đoạn; lỗi phải có thể quan sát và không để trạng thái `processing` vô hạn.

3.3. **Tính nhất quán:** Một document SHALL có cùng `document_id` xuyên suốt create, background ingest, update/status và recovery; build/runtime SHALL dùng cùng cache model/tokenizer.

3.4. **Bảo mật:** Các thay đổi SHALL giữ nguyên owner isolation, không log secrets và không mở rộng quyền truy cập dữ liệu hoặc storage.

3.5. **Tương thích:** API và healthcheck hiện có SHALL tiếp tục hoạt động với client/deployment hiện tại; thay đổi response chỉ ở mức cần thiết để biểu đạt trạng thái lỗi/ready chính xác hơn.

3.6. **Tài nguyên:** Giải pháp SHALL phù hợp với container hiện tại trên EC2 2 GiB, không phụ thuộc vào tăng RAM, không cần worker/message queue riêng và không nhân bản cache model/tokenizer.

3.7. **Quan sát vận hành:** Log/metric cho ingest và readiness SHALL đủ để phân biệt create, bắt đầu xử lý, hoàn tất, timeout, retry, recovery, lỗi storage và lỗi ownership; thông tin này SHALL được gắn correlation/document identifier an toàn.

3.8. **Khả năng kiểm thử:** Các acceptance criteria SHALL có thể kiểm chứng bằng test đơn vị, test tích hợp hoặc kiểm tra property với cả trường hợp lỗi và trường hợp cần bảo toàn; các kiểm tra phải bao gồm owner khác nhau, timeout/recovery, cache readiness và môi trường thiếu mạng.

## 4. Ngoài phạm vi

- Xây dựng hoặc bổ sung OCR mới.
- Tách ingest thành worker riêng hoặc giới thiệu message queue riêng.
- Thay đổi embedding model.
- Thay đổi schema cơ sở dữ liệu nếu không cần thiết để đáp ứng các yêu cầu trên.
- Thay đổi hợp đồng API, route hoặc healthcheck ngoài các điều chỉnh tối thiểu cần để sửa trạng thái ingest và readiness theo tài liệu này.
- Mở rộng hạ tầng hoặc tăng giới hạn tài nguyên vượt môi trường EC2 2 GiB hiện tại.
- Thay đổi chính sách owner/authorization theo hướng nới lỏng quyền truy cập.
