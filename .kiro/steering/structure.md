# Project Structure

## Top-level organization

- `frontend/` — React SPA. `src/pages/` contains route-level composition; `src/components/<feature>/` contains presentation; `src/components/ui/` contains reusable primitives; `src/hooks/` owns auth and remote state; `src/lib/api.ts` and `src/lib/supabase.ts` are integration boundaries.
- `backend/app/` — FastAPI application. `main.py` creates long-lived services and mounts `/api/v1`; `api/` contains dependencies and routes; `schemas/` contains Pydantic API contracts; `services/` contains PDF, embedding, retrieval, Dify, storage, and rate-limit logic; `db/repositories/` contains SQL access.
- `backend/tests/` — pytest behavior tests and reusable fakes.
- `supabase/migrations/` — canonical PostgreSQL schema, pgvector/full-text indexes, triggers, and RLS policies. Keep the deployment copy under `backend/app/db/migrations/` synchronized when schema changes require it.
- `deploy/` — Docker Compose, Nginx, and VPS setup.
- `scripts/` — development/evaluation utilities; `scripts/evaluate.py` still has a placeholder retrieval callback.

## Architecture flow

1. `frontend/src/main.tsx` initializes routing and Supabase auth; `App.tsx` separates public and protected routes.
2. Pages compose feature components and hooks. `frontend/src/lib/api.ts` adds the Supabase bearer token, handles JSON/SSE, and is the sole browser-to-backend API boundary.
3. FastAPI dependencies authenticate users and provide settings/database access. Routes orchestrate repositories and services initialized in application lifespan state.
4. Document ingestion validates and deduplicates a PDF, stores it privately, creates a document row, then parses, chunks, embeds, and transactionally stores chunks before setting a terminal status.
5. Chat validates ownership, persists the user message, performs owner-scoped hybrid retrieval, builds numbered citation context, streams Dify output, and persists the assistant message and citations.
6. PostgreSQL RLS and explicit `owner_id` predicates jointly enforce tenant isolation.

## Placement rules

- Add endpoints in `backend/app/api/v1/<feature>.py` and register them in `api/v1/router.py`; shared request/response models belong in `schemas/`.
- Put new external integrations or domain operations in `services/`; put all SQL in owner-scoped repository classes.
- Make schema changes in a new canonical `supabase/migrations/` migration; do not silently edit only the backend copy.
- Add top-level frontend routes to `src/pages/` and `App.tsx`; feature UI to `src/components/<feature>/`; reusable primitives to `src/components/ui/`; reusable stateful behavior to `src/hooks/`; API/auth/config utilities to `src/lib/`.
- Keep browser code free of backend secrets and direct database, S3, or Dify access. Keep SQL out of route handlers and raw fetch logic out of UI components.
