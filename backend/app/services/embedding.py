import asyncio
import threading
from typing import Any

import numpy as np

from app.core.config import Settings


class EmbeddingService:
    def __init__(self, settings: Settings) -> None:
        self.model_name = settings.embedding_model
        self.dimension = settings.embedding_dimension
        self.batch_size = settings.embedding_batch_size
        self._model: Any = None
        self._lock = threading.Lock()

    @property
    def configured(self) -> bool:
        return bool(self.model_name)

    def _load_model(self) -> Any:
        if self._model is None:
            with self._lock:
                if self._model is None:
                    from sentence_transformers import SentenceTransformer

                    self._model = SentenceTransformer(self.model_name)
                    actual_dimension = self._model.get_sentence_embedding_dimension()
                    if actual_dimension and actual_dimension != self.dimension:
                        raise RuntimeError(
                            f"Embedding dimension mismatch: configured={self.dimension}, model={actual_dimension}"
                        )
        return self._model

    def _encode_sync(self, texts: list[str]) -> list[list[float]]:
        model = self._load_model()
        vectors = model.encode(
            texts,
            batch_size=self.batch_size,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True,
        )
        array = np.asarray(vectors, dtype=np.float32)
        if array.ndim == 1:
            array = array.reshape(1, -1)
        return array.tolist()

    async def encode(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return await asyncio.to_thread(self._encode_sync, texts)
