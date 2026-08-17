from app.core.config import Settings
from app.services.storage import StorageService


def test_storage_service_supports_custom_tencent_cos_endpoint():
    settings = Settings(
        s3_bucket_name="examoras-cos-1250000000",
        s3_region="ap-singapore",
        s3_endpoint_url="https://cos.ap-singapore.myqcloud.com",
        aws_access_key_id="test_secret_id",
        aws_secret_access_key="test_secret_key",
    )

    storage = StorageService(settings)
    assert storage.configured is True
    assert storage.bucket == "examoras-cos-1250000000"
    assert storage.endpoint_url == "https://cos.ap-singapore.myqcloud.com"
    assert storage.client.meta.endpoint_url == "https://cos.ap-singapore.myqcloud.com"
