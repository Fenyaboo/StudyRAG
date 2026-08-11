"""Task 3.4 / Property 8 — đường khởi động phải sạch ML.

Đây là phiên bản thực thi được của Yêu cầu 6 tiêu chí 7. Nó chặn nguyên nhân gốc của
rủi ro R1: một import ML ở module scope lọt vào đường khởi động sẽ không gây lỗi nào ở
máy dev đã cài ML, nhưng làm sập startup ở production nơi các package đó không tồn tại.
"""

import os
import subprocess
import sys

BANNED_MODULES = ("torch", "transformers", "sentence_transformers", "numpy")

PROBE = """
import sys
import app.main  # noqa: F401

banned = [name for name in {banned!r} if name in sys.modules]
print(",".join(banned))
"""


def test_importing_app_main_does_not_pull_ml_modules():
    """Chạy trong subprocess sạch vì tiến trình pytest có thể đã import numpy qua đường khác."""
    env = dict(os.environ)
    env["AI_FEATURES_ENABLED"] = "false"
    # `app` nằm dưới backend/; chạy probe với backend/ là cwd để import được.
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env["PYTHONPATH"] = backend_dir

    completed = subprocess.run(
        [sys.executable, "-c", PROBE.format(banned=BANNED_MODULES)],
        capture_output=True,
        text=True,
        cwd=backend_dir,
        env=env,
        timeout=120,
    )

    assert completed.returncode == 0, (
        "Import app.main thất bại ở AI_Disabled_Mode.\n"
        f"stdout: {completed.stdout}\nstderr: {completed.stderr}"
    )
    leaked = [name for name in completed.stdout.strip().split(",") if name]
    assert leaked == [], (
        "Đường khởi động đã kéo module ML vào sys.modules: "
        f"{leaked}. Kiểm tra lại import ở module scope trong app/main.py, "
        "app/api/**, và app/services/__init__.py."
    )
