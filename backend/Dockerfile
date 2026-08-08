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

# HF_HOME thay cho TRANSFORMERS_CACHE (đã deprecated ở transformers 4.48).
# SENTENCE_TRANSFORMERS_HOME phải trùng với cache_folder dùng lúc build model,
# nếu không runtime sẽ tải lại toàn bộ model.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    HF_HOME=/opt/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/opt/huggingface \
    PATH="/opt/venv/bin:/usr/local/bin:$PATH"

RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 appuser \
    && mkdir -p /opt/huggingface \
    && chown -R appuser:appuser /opt/huggingface

COPY --from=builder /opt/venv /opt/venv

# Tải model TRƯỚC khi COPY code: sửa code Python không làm vỡ cache layer này.
ARG EMBEDDING_MODEL=bkai-foundation-models/vietnamese-bi-encoder
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('${EMBEDDING_MODEL}', cache_folder='/opt/huggingface')" \
    && chown -R appuser:appuser /opt/huggingface

COPY app /app/app

WORKDIR /app
USER appuser
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
