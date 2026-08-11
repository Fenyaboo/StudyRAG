# Product Overview

StudyRAG V2 is a Vietnamese-language AI study assistant for grade-12 Mathematics, Physics, and Chemistry. Students upload their own exam or textbook PDFs, organize them by subject, and ask questions grounded in those documents. Answers stream to the browser and include page-aware source citations.

## Core capabilities

- Supabase email/password and Google authentication with protected application routes.
- Private per-user PDF library with upload, filtering, status tracking, deletion, and temporary download URLs.
- PDF text extraction, overlapping chunking, Vietnamese embeddings, and hybrid vector/full-text retrieval.
- Conversation history and RAG chat over all ready documents or one selected document.
- Dify-powered answer generation delivered through server-sent events (SSE).

## Product constraints

- The backend owns retrieval and sends retrieved context to Dify through `inputs.context`; do not also enable Dify Knowledge Retrieval.
- Every document, conversation, message, and retrieval query must remain scoped to the authenticated owner.
- Only text-bearing PDFs are indexed. Image-only PDFs become `ocr_required`; there is no OCR pipeline yet.
- Ingestion uses in-process FastAPI background tasks, and rate limiting is in-memory. Do not assume either is durable or distributed.
- Preserve Vietnamese user-facing copy and the grounded-answer behavior: when no relevant chunks exist, say so rather than generating an unsupported answer.
