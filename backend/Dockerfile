FROM python:3.12-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

RUN python -m venv /opt/venv \
    && apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/requirements.txt
RUN /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install -r /tmp/requirements.txt

FROM python:3.12-slim AS runtime

# Ở AI_Disabled_Mode image không cài torch/transformers/sentence-transformers/numpy,
# nên không còn cache model embedding: HF_HOME và SENTENCE_TRANSFORMERS_HOME đã được bỏ.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:/usr/local/bin:$PATH"

# libglib2.0-0 và libgl1 là dependency hệ thống của PyMuPDF (không phải của torch), nên giữ lại.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 appuser

COPY --from=builder /opt/venv /opt/venv

# Gate build: image vi phạm không bao giờ được tạo nên không thể publish.
# Bản đầy đủ của kiểm tra này nằm ở scripts/verify_no_ml_packages.py (dùng cho CI);
# ở đây viết inline vì build context là `backend/` nên scripts/ ở gốc repo không có trong context.
RUN python -c "\
import importlib.util, sys; \
banned = [n for n in ('torch','transformers','sentence_transformers','numpy') if importlib.util.find_spec(n)]; \
sys.exit('Runtime image chua package AI bi cam o AI_Disabled_Mode: ' + ', '.join(banned)) if banned else None; \
sys.exit('Thieu PyMuPDF (module fitz)') if importlib.util.find_spec('fitz') is None else None; \
print('OK: runtime image khong chua package ML, PyMuPDF kha dung')"

COPY app /app/app

WORKDIR /app
USER appuser
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
