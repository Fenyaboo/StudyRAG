import logging
import time
from typing import List, Dict, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

class LLMService:
    """
    Dịch vụ xử lý suy luận AI cho trạm StudyRAG V2.
    Hỗ trợ đa mô hình: Google Gemini, NVIDIA NIM, OpenAI, và Local Ollama.
    Tự động xây dựng Context từ các đoạn vector (Chunks) và trích xuất trích dẫn (Citations).
    """

    @classmethod
    async def generate_grounded_answer(
        cls,
        query: str,
        chunks: List[Dict[str, Any]],
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        start_time = time.perf_counter()
        provider = settings.LLM_PROVIDER.lower().strip()

        # Xây dựng context ngữ cảnh từ các đoạn tài liệu tìm thấy
        context_blocks = []
        citations = []
        for i, ch in enumerate(chunks, 1):
            doc_name = ch.get("file_name") or ch.get("document_name") or "Tài liệu"
            page = ch.get("page", 1)
            text = ch.get("content") or ch.get("text", "")
            score = round(ch.get("score", 0.0), 3)

            block_label = f"[{i}] [Trang {page}, {doc_name}]"
            context_blocks.append(f"{block_label}:\n{text}")
            citations.append({
                "index": i,
                "document_name": doc_name,
                "page": page,
                "text": text[:180] + ("..." if len(text) > 180 else ""),
                "score": score
            })

        context_str = "\n\n---\n\n".join(context_blocks) if context_blocks else "Không có đoạn thông tin nào từ tài liệu."

        default_system = (
            "Bạn là Trợ lý AI chuyên gia ôn thi THPT Quốc Gia (Toán, Lý, Hóa) thuộc hệ thống StudyRAG.\n"
            "Nhiệm vụ của bạn là trả lời câu hỏi của học sinh BẮT BUỘC dựa trên các đoạn tài liệu ngữ cảnh dưới đây.\n"
            "Quy tắc tuyệt đối:\n"
            "1. Chỉ sử dụng thông tin trong Ngữ cảnh (Context) được cung cấp. Nếu thông tin không đủ, hãy nói rõ: 'Trong tài liệu hiện tại chưa có đủ thông tin để trả lời câu hỏi này.'\n"
            "2. Khi trả lời, BẮT BUỘC ghi rõ trích dẫn số trang và tài liệu nguồn tương ứng, ví dụ: [Trang 1, e1b1.pdf] hoặc [1].\n"
            "3. Trình bày lời giải toán, công thức mạch lạc, dễ hiểu theo từng bước logic chuẩn sư phạm."
        )

        sys_prompt = system_prompt or default_system
        user_prompt = f"NGỮ CẢNH TÀI LIỆU (CONTEXT):\n{context_str}\n\nCÂU HỎI CỦA HỌC SINH:\n{query}"

        answer = ""
        error_msg = None

        try:
            if provider == "nvidia":
                answer = await cls._call_nvidia(sys_prompt, user_prompt)
            elif provider == "gemini":
                answer = await cls._call_gemini(sys_prompt, user_prompt)
            elif provider == "openai":
                answer = await cls._call_openai(sys_prompt, user_prompt)
            else: # ollama
                answer = await cls._call_ollama(sys_prompt, user_prompt)
        except Exception as e:
            logger.error(f"Lỗi khi gọi provider '{provider}': {str(e)}")
            error_msg = f"Lỗi kết nối tới mô hình AI '{provider}': {str(e)}"
            answer = (
                f"⚠️ Xin lỗi bạn, hiện tại kết nối tới mô hình AI ({provider.upper()}) gặp sự cố hoặc chưa cấu hình API Key chính xác.\n\n"
                f"👉 Dưới đây là các đoạn thông tin liên quan nhất từ tài liệu mà hệ thống đã tìm thấy để bạn tham khảo trực tiếp:\n\n"
                + "\n\n".join([f"**{c['document_name']} (Trang {c['page']})**:\n{c['text']}" for c in citations])
            )

        latency_ms = round((time.perf_counter() - start_time) * 1000)

        return {
            "answer": answer,
            "citations": citations,
            "provider": provider,
            "model": cls._get_current_model_name(provider),
            "latency_ms": latency_ms,
            "error": error_msg
        }

    @classmethod
    def _get_current_model_name(cls, provider: str) -> str:
        if provider == "nvidia":
            return settings.NVIDIA_MODEL
        elif provider == "gemini":
            return settings.GEMINI_MODEL
        elif provider == "openai":
            return settings.OPENAI_MODEL
        return settings.OLLAMA_MODEL or "qwen2.5:7b"

    @classmethod
    async def _call_nvidia(cls, sys_prompt: str, user_prompt: str) -> str:
        if not settings.NVIDIA_API_KEY:
            raise ValueError("Chưa thiết lập biến NVIDIA_API_KEY trong .env hoặc Render.")
        
        url = f"{settings.NVIDIA_BASE_URL}/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": settings.NVIDIA_MODEL,
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.2,
            "max_tokens": 1500
        }
        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            res.raise_for_status()
            data = res.json()
            return data["choices"][0]["message"]["content"]

    @classmethod
    async def _call_gemini(cls, sys_prompt: str, user_prompt: str) -> str:
        if not settings.GEMINI_API_KEY:
            raise ValueError("Chưa thiết lập biến GEMINI_API_KEY trong .env hoặc Render.")
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": f"{sys_prompt}\n\n{user_prompt}"}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1500
            }
        }
        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(url, json=payload)
            res.raise_for_status()
            data = res.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

    @classmethod
    async def _call_openai(cls, sys_prompt: str, user_prompt: str) -> str:
        if not settings.OPENAI_API_KEY:
            raise ValueError("Chưa thiết lập biến OPENAI_API_KEY.")
        
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": settings.OPENAI_MODEL,
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.2
        }
        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            res.raise_for_status()
            data = res.json()
            return data["choices"][0]["message"]["content"]

    @classmethod
    async def _call_ollama(cls, sys_prompt: str, user_prompt: str) -> str:
        url = f"{settings.OLLAMA_BASE_URL}/api/chat"
        payload = {
            "model": settings.OLLAMA_MODEL or "qwen2.5:7b",
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "stream": False,
            "options": {"temperature": 0.2}
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(url, json=payload)
            res.raise_for_status()
            data = res.json()
            return data["message"]["content"]
