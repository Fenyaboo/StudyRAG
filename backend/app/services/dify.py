from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.core.config import Settings


class DifyError(RuntimeError):
    pass


@dataclass(frozen=True)
class DifyEvent:
    event: str
    answer: str = ""
    message_id: str | None = None
    conversation_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class DifyClient:
    def __init__(self, settings: Settings) -> None:
        self.base_url = settings.dify_api_base_url.rstrip("/")
        self.api_key = settings.dify_api_key
        self.timeout = settings.dify_timeout_seconds

    @property
    def configured(self) -> bool:
        return bool(self.api_key and self.base_url)

    async def stream_chat(
        self,
        *,
        query: str,
        context: str,
        user_id: str,
        conversation_id: str | None = None,
    ) -> AsyncIterator[DifyEvent]:
        if not self.configured:
            raise DifyError("Dify is not configured")
        payload: dict[str, Any] = {
            "inputs": {"context": context},
            "query": query,
            "response_mode": "streaming",
            "user": user_id,
        }
        if conversation_id:
            payload["conversation_id"] = conversation_id
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        }
        timeout = httpx.Timeout(self.timeout, connect=15.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat-messages",
                    headers=headers,
                    json=payload,
                ) as response:
                    if response.status_code >= 400:
                        body = await response.aread()
                        raise DifyError(f"Dify returned {response.status_code}: {body[:500].decode(errors='replace')}")
                    current_event = "message"
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        if line.startswith("event:"):
                            current_event = line[6:].strip()
                            continue
                        if not line.startswith("data:"):
                            continue
                        raw = line[5:].strip()
                        if raw == "[DONE]":
                            break
                        try:
                            data = httpx.Response(200, content=raw).json()
                        except ValueError:
                            continue
                        yield DifyEvent(
                            event=str(data.get("event", current_event)),
                            answer=str(data.get("answer") or data.get("text") or data.get("delta") or ""),
                            message_id=data.get("message_id"),
                            conversation_id=data.get("conversation_id"),
                            metadata=data.get("metadata") or {},
                        )
            except httpx.HTTPError as exc:
                raise DifyError(f"Dify request failed: {exc}") from exc
