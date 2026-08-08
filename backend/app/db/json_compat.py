"""Chuẩn hóa giá trị json/jsonb đọc từ database.

Pool đăng ký codec jsonb trong `app/db/connection.py`, nên giá trị mới luôn được
decode thành `dict`/`list`. Tuy nhiên dữ liệu ghi bởi phiên bản cũ từng bị
double-encode (repository tự `json.dumps` rồi codec dumps lần nữa), nên khi đọc
lại sẽ ra `str`. Các helper dưới đây giúp đọc được cả dữ liệu cũ và mới mà không
cần migration bắt buộc.
"""

import json
from typing import Any


def _decode(value: Any, depth: int = 3) -> Any:
    """Giải mã tối đa `depth` lớp JSON string để xử lý dữ liệu bị encode nhiều lần."""
    for _ in range(depth):
        if not isinstance(value, str):
            break
        try:
            value = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return None
    return value


def as_json_dict(value: Any) -> dict[str, Any]:
    """Trả về dict; nếu giá trị không hợp lệ thì trả về dict rỗng."""
    if value is None:
        return {}
    decoded = _decode(value)
    return dict(decoded) if isinstance(decoded, dict) else {}


def as_json_list(value: Any) -> list[Any]:
    """Trả về list; nếu giá trị không hợp lệ thì trả về list rỗng."""
    if value is None:
        return []
    decoded = _decode(value)
    return list(decoded) if isinstance(decoded, list) else []
