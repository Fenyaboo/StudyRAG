import os

import pytest

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("EMBEDDING_MODEL", "test-model")
os.environ.setdefault("EMBEDDING_DIMENSION", "3")


@pytest.fixture
def fake_pages():
    from app.services.pdf_parser import PageText

    return [
        PageText(page_number=1, text="Định luật bảo toàn cơ năng.\n\nCơ năng được bảo toàn khi chỉ có lực thế."),
        PageText(page_number=2, text="Bài tập: Một vật chuyển động trong trọng trường."),
    ]
