# Triển khai StudyRAG V2 trên AWS (Milestone 5)

## 1. Sơ đồ Production trên AWS

```text
GitHub
  ├── AWS Amplify ── React Frontend (Static Build + CDN)
  └── CI Pipeline ── AWS App Runner Backend
                         ├── S3 Private Bucket (Lưu PDF)
                         ├── PostgreSQL / RDS Metadata
                         ├── Managed Vector Store (pgvector / Qdrant)
                         ├── AWS Secrets Manager (API Keys)
                         └── CloudWatch Logs
```

## 2. Lưu ý bảo mật & Rollback
- S3 Bucket phải đặt quyền Private 100%, sử dụng Presigned URLs có thời hạn ngắn (15-60 phút) để Frontend tải hoặc hiển thị PDF.
- AWS App Runner cấu hình tự động scale nhưng giới hạn concurrency để bảo vệ RAM khi trích xuất PDF/embedding.
- Mọi biến môi trường nhạy cảm như `OPENAI_API_KEY` phải lưu trong AWS Secrets Manager và mount vào container App Runner.
