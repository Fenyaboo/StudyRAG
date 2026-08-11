"""Package dịch vụ.

Cố ý KHÔNG re-export eager. Trước đây file này import sẵn `SmartChunker`,
`DifyClient`, `EmbeddingService`, `PDFParser`, `StorageService`, nên bất kỳ
`from app.services.<module> import X` cũng chạy `__init__` và do đó import
`embedding` -> `numpy`, kéo toàn bộ tầng ML vào đường khởi động. Ở
`AI_Disabled_Mode` các package ML không được cài, nên việc đó sẽ làm sập startup.

Mọi call site phải import trực tiếp từ module con. Đừng thêm lại re-export ở đây:
`backend/tests/test_no_ml_imports.py` sẽ thất bại nếu bất biến này bị phá.
"""

__all__: list[str] = []
