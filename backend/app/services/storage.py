import asyncio
import time
from io import BytesIO

import boto3
from botocore.client import Config

from app.core.config import Settings


class StorageService:
    def __init__(self, settings: Settings) -> None:
        self.bucket = settings.s3_bucket_name
        self.region = settings.s3_region
        endpoint = settings.s3_endpoint_url.strip() if settings.s3_endpoint_url else None
        if endpoint and self.bucket and f"{self.bucket}." in endpoint:
            # Tự động gỡ bỏ tên bucket khỏi endpoint nếu người dùng dán nhầm URL đầy đủ
            endpoint = endpoint.replace(f"{self.bucket}.", "")
        self.endpoint_url = endpoint or None
        client_kwargs: dict[str, object] = {"region_name": self.region, "config": Config(signature_version="s3v4")}
        if self.endpoint_url:
            client_kwargs["endpoint_url"] = self.endpoint_url
        if settings.aws_access_key_id and settings.aws_secret_access_key:
            client_kwargs.update(
                {
                    "aws_access_key_id": settings.aws_access_key_id,
                    "aws_secret_access_key": settings.aws_secret_access_key,
                }
            )
        self.client = boto3.client("s3", **client_kwargs)
        self._check_cache: tuple[float, bool] | None = None

    @property
    def configured(self) -> bool:
        return bool(self.bucket)

    async def upload_pdf(self, storage_key: str, content: bytes) -> None:
        if not self.configured:
            raise RuntimeError("S3_BUCKET_NAME is not configured")

        def upload() -> None:
            self.client.upload_fileobj(
                BytesIO(content),
                self.bucket,
                storage_key,
                ExtraArgs={"ContentType": "application/pdf", "ServerSideEncryption": "AES256"},
            )

        await asyncio.to_thread(upload)

    async def delete(self, storage_key: str) -> None:
        if not self.configured:
            return
        await asyncio.to_thread(self.client.delete_object, Bucket=self.bucket, Key=storage_key)

    async def presigned_url(self, storage_key: str, *, expires_in: int = 900) -> str:
        if not self.configured:
            raise RuntimeError("S3_BUCKET_NAME is not configured")
        return await asyncio.to_thread(
            self.client.generate_presigned_url,
            "get_object",
            Params={"Bucket": self.bucket, "Key": storage_key},
            ExpiresIn=expires_in,
        )

    async def check(self) -> bool:
        if not self.configured:
            return False
        try:
            await asyncio.to_thread(self.client.head_bucket, Bucket=self.bucket)
            return True
        except Exception:
            return False

    async def check_cached(self, *, ttl: float = 30.0) -> bool:
        """`check()` với cache ngắn để health polling không gọi S3 liên tục."""
        now = time.monotonic()
        cached = self._check_cache
        if cached is not None and now - cached[0] < ttl:
            return cached[1]
        result = await self.check()
        self._check_cache = (now, result)
        return result
