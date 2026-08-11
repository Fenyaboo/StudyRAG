"""Fail build/CI nếu môi trường runtime chứa package ML bị cấm ở AI_Disabled_Mode.

Kiểm tra hai lớp:
1. Tên distribution đã cài (bắt cả trường hợp package tới dưới dạng dependency gián tiếp).
2. Tên module import được (bắt trường hợp package nằm sẵn trong image mà không qua pip).

Đồng thời khẳng định PyMuPDF vẫn import được, vì parse PDF phải tiếp tục hoạt động.

Dùng ở hai nơi:
- Một job CI riêng, để thông điệp lỗi hiện ra trước khi push image.
- Trong `backend/Dockerfile` bản kiểm tra tương đương được viết inline, vì build context
  hiện là `backend/` nên file này không nằm trong context.
"""

import importlib.metadata
import importlib.util
import sys

# Console Windows mặc định là cp1252 và không encode được tiếng Việt, làm script sập bằng
# UnicodeEncodeError thay vì báo đúng kết quả kiểm tra. errors="replace" để thông điệp xấu
# đi chứ không bao giờ làm sai exit code.
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")

BANNED_DISTRIBUTIONS = {"torch", "transformers", "sentence-transformers", "numpy"}
BANNED_MODULES = ("torch", "transformers", "sentence_transformers", "numpy")


def installed_distribution_names() -> set[str]:
    names: set[str] = set()
    for dist in importlib.metadata.distributions():
        raw = dist.metadata["Name"] if dist.metadata else None
        if raw:
            names.add(raw.strip().lower())
    return names


def find_violations() -> list[str]:
    violations = set(BANNED_DISTRIBUTIONS & installed_distribution_names())
    violations |= {name for name in BANNED_MODULES if importlib.util.find_spec(name) is not None}
    return sorted(violations)


def main() -> int:
    violations = find_violations()
    if violations:
        print(
            "Runtime image chứa package AI bị cấm ở AI_Disabled_Mode: "
            + ", ".join(violations)
            + "\nCác package này chỉ được cài khi AI_FEATURES_ENABLED=true "
            "(backend/requirements-ai.txt).",
            file=sys.stderr,
        )
        return 1

    if importlib.util.find_spec("fitz") is None:
        print("Thiếu PyMuPDF (module `fitz`): parse PDF sẽ không hoạt động.", file=sys.stderr)
        return 1

    print("OK: không có torch/transformers/sentence-transformers/numpy, PyMuPDF khả dụng.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
