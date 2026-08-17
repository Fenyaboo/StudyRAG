"""Script kiểm tra kết nối trực tiếp tới Tencent Cloud COS.

Cách chạy:
    .venv-win\\Scripts\\python.exe scripts\\test_tencent_cos.py
"""

import os
import sys
from pathlib import Path
import boto3
from botocore.config import Config
from dotenv import load_dotenv

# Nạp file .env từ thư mục gốc hoặc backend/.env
root_dir = Path(__file__).resolve().parent.parent
load_dotenv(root_dir / ".env")
load_dotenv(root_dir / "backend" / ".env")

raw_endpoint = os.getenv("S3_ENDPOINT_URL", "https://cos.ap-singapore.myqcloud.com")
bucket_name = os.getenv("S3_BUCKET_NAME")
region = os.getenv("S3_REGION", "ap-singapore")
secret_id = os.getenv("AWS_ACCESS_KEY_ID")
secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")

# Tự động gỡ bỏ tên bucket nếu lỡ dán URL đầy đủ
endpoint_url = raw_endpoint
if bucket_name and f"{bucket_name}." in endpoint_url:
    endpoint_url = endpoint_url.replace(f"{bucket_name}.", "")


def print_step(title: str, status: str = ""):
    print(f"\n👉 {title} {status}")


def test_cos_connection():
    print("=" * 60)
    print("🧪 KIỂM TRA KẾT NỐI TENCENT CLOUD COS — EXAMORAS")
    print("=" * 60)
    print(f"• Endpoint URL : {endpoint_url}")
    if raw_endpoint != endpoint_url:
        print(f"  (Đã tự động chuẩn hóa từ '{raw_endpoint}')")
    print(f"• Region       : {region}")
    print(f"• Bucket       : {bucket_name or '[CHƯA CẤU HÌNH]'}")
    print(f"• SecretId     : {secret_id[:8]}... (đã ẩn)" if secret_id else "• SecretId     : [CHƯA CẤU HÌNH]")

    if not bucket_name or not secret_id or not secret_key:
        print("\n❌ LỖI: Chưa cấu hình đầy đủ biến môi trường trong .env!")
        print("Vui lòng điền vào file .env:")
        print("  S3_ENDPOINT_URL=https://cos.ap-singapore.myqcloud.com")
        print("  S3_BUCKET_NAME=examoras-1250000000")
        print("  S3_REGION=ap-singapore")
        print("  AWS_ACCESS_KEY_ID=AKID...")
        print("  AWS_SECRET_ACCESS_KEY=...")
        sys.exit(1)

    # 1. Khởi tạo S3 Client tương thích Tencent COS
    print_step("Bước 1: Khởi tạo client kết nối qua S3 API...")
    try:
        client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            region_name=region,
            aws_access_key_id=secret_id,
            aws_secret_access_key=secret_key,
            config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
        )
        print("   ✅ Client khởi tạo thành công.")
    except Exception as e:
        print(f"   ❌ Lỗi khởi tạo: {e}")
        sys.exit(1)

    # 2. Kiểm tra tồn tại của Bucket
    print_step(f"Bước 2: Kiểm tra Bucket '{bucket_name}'...")
    try:
        client.head_bucket(Bucket=bucket_name)
        print(f"   ✅ Bucket '{bucket_name}' tồn tại và có quyền truy cập!")
    except Exception as e:
        print(f"   ❌ Không thể truy cập Bucket: {e}")
        print("   💡 Gợi ý: Kiểm tra lại tên Bucket (phải có AppID đuôi -125xxxxxx) hoặc phân quyền CAM user.")
        sys.exit(1)

    # 3. Tải lên file test
    test_key = "test-connection/examoras_test.pdf"
    test_content = b"%PDF-1.4\n1 0 obj\n<< /Title (Examoras Test PDF) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    print_step(f"Bước 3: Thử tải lên file test '{test_key}'...")
    try:
        client.put_object(
            Bucket=bucket_name,
            Key=test_key,
            Body=test_content,
            ContentType="application/pdf",
        )
        print("   ✅ Upload file PDF test thành công!")
    except Exception as e:
        print(f"   ❌ Upload thất bại: {e}")
        sys.exit(1)

    # 4. Sinh Presigned URL tải file
    print_step("Bước 4: Sinh Presigned URL (chữ ký bảo mật 15 phút)...")
    try:
        url = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket_name, "Key": test_key},
            ExpiresIn=900,
        )
        print(f"   ✅ Presigned URL hợp lệ:\n   🔗 {url[:100]}...")
    except Exception as e:
        print(f"   ❌ Sinh Presigned URL thất bại: {e}")
        sys.exit(1)

    # 5. Dọn dẹp file test
    print_step("Bước 5: Dọn dẹp file test trên Tencent COS...")
    try:
        client.delete_object(Bucket=bucket_name, Key=test_key)
        print("   ✅ Đã xóa file test an toàn.")
    except Exception as e:
        print(f"   ⚠️ Không xóa được file test: {e}")

    print("\n" + "=" * 60)
    print("🎉 KẾT QUẢ: TENCENT CLOUD COS ĐÃ SẴN SÀNG HOẠT ĐỘNG 100%!")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    test_cos_connection()
