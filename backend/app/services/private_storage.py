import re

import httpx

from app.core.config import settings


BUCKET_NAME = "study-documents"


def sanitize_filename(filename: str) -> str:
    """Return a filename safe to use as one segment of a Storage object path."""
    basename = filename.replace("\\", "/").rsplit("/", maxsplit=1)[-1]
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "_", basename).strip("._")
    return sanitized or "document.pdf"


class PrivateStorage:
    def __init__(self, client: httpx.Client | None = None) -> None:
        self.base_url = settings.SUPABASE_URL.rstrip("/")
        self.service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY
        self.client = client or httpx.Client(timeout=30.0)

    def _headers(self) -> dict[str, str]:
        if not self.base_url or not self.service_role_key:
            raise RuntimeError("Private Supabase Storage is not configured.")
        return {
            "Authorization": f"Bearer {self.service_role_key}",
            "apikey": self.service_role_key,
        }

    @staticmethod
    def build_path(owner_id: str, document_id: str, filename: str) -> str:
        return f"{owner_id}/{document_id}/{sanitize_filename(filename)}"

    def put_pdf(self, owner_id: str, document_id: str, filename: str, content: bytes) -> str:
        storage_path = self.build_path(owner_id, document_id, filename)
        response = self.client.post(
            f"{self.base_url}/storage/v1/object/{BUCKET_NAME}/{storage_path}",
            content=content,
            headers={**self._headers(), "Content-Type": "application/pdf", "x-upsert": "false"},
        )
        response.raise_for_status()
        return storage_path

    def download_pdf(self, storage_path: str) -> bytes:
        """Read a private object before a compensating delete transaction."""
        response = self.client.get(
            f"{self.base_url}/storage/v1/object/{BUCKET_NAME}/{storage_path}",
            headers=self._headers(),
        )
        response.raise_for_status()
        return response.content

    def restore_pdf(self, storage_path: str, content: bytes) -> None:
        """Restore an object at exactly its original key after a DB delete failure."""
        response = self.client.post(
            f"{self.base_url}/storage/v1/object/{BUCKET_NAME}/{storage_path}",
            content=content,
            headers={**self._headers(), "Content-Type": "application/pdf", "x-upsert": "true"},
        )
        response.raise_for_status()

    def delete_pdf(self, storage_path: str) -> None:
        response = self.client.delete(
            f"{self.base_url}/storage/v1/object/{BUCKET_NAME}/{storage_path}",
            headers=self._headers(),
        )
        response.raise_for_status()
