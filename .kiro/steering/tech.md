# Technology and Conventions

## Stack

- **Frontend:** TypeScript (strict), React 18, Vite 6, React Router, Supabase JS, Tailwind CSS, Lucide, React Markdown/GFM, and KaTeX.
- **Backend:** Python 3.12+, FastAPI, Pydantic v2, Uvicorn, asyncpg, and pytest/pytest-asyncio.
- **RAG:** PyMuPDF, sentence-transformers with the Vietnamese bi-encoder (768 dimensions), pgvector, PostgreSQL full-text search, reciprocal-rank fusion, and Dify Chatbot streaming.
- **Services:** Supabase Auth/PostgreSQL, private S3-compatible storage, Vercel for the SPA, and Docker Compose/Nginx for the API.

## Common commands

The root `Makefile` is canonical and assumes a POSIX shell (Linux, macOS, WSL, or Git Bash):

```sh
make install     # Python and frontend dependencies
make test        # backend pytest suite only
make lint        # Python compile check and frontend TypeScript check
make build       # production frontend build
make dev         # prints, but does not start, the two development commands
make migrate     # prints migration instructions
```

Run development processes in separate terminals:

```sh
PYTHONPATH=backend .venv/bin/uvicorn app.main:app --reload
npm --prefix frontend run dev
```

On native PowerShell, use `.venv\Scripts\python.exe`/`.venv\Scripts\uvicorn.exe` and set `$env:PYTHONPATH = "backend"`; npm commands are unchanged. Production backend: `docker compose -f deploy/docker-compose.yml up -d --build`.

## Coding rules

- Backend code is typed and asynchronous. Use Pydantic schemas for wire contracts, `Annotated` FastAPI dependencies, parameterized SQL, and owner-scoped repository methods.
- Keep route modules focused on validation and orchestration; put integrations/domain behavior in `services/` and SQL in `db/repositories/`.
- Frontend code uses strict TypeScript, PascalCase components, `use*` hooks, named exports, relative imports, Tailwind utilities, and centralized clients in `src/lib/`.
- Do not scatter raw API calls through components; extend `frontend/src/lib/api.ts` and expose remote state through hooks where appropriate.
- Ruff is configured for Python 3.12, 100-character lines, and E/F/I/UP rules, but is not installed by the project or run by `make lint`. No ESLint, Prettier, frontend test runner, or Node version is declared; do not claim or depend on them without adding configuration deliberately.
- Backend tests use pytest and lightweight fakes rather than live Supabase, S3, Dify, or embedding services. Add targeted tests when changing existing tested behavior.

## Configuration and security

- Copy `backend/.env.example` and `frontend/.env.example`; backend settings are centralized in `backend/app/core/config.py`.
- Only `VITE_*` public values belong in browser configuration. Never expose or commit `.env`, service-role keys, Dify/AWS secrets, or user PDFs.
- Use the Supabase Session Pooler on port 5432; the current asyncpg setup is incompatible with Transaction Pooler port 6543.
