# Supabase Auth and Private Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require Supabase login before StudyRAG actions and make each user's PDFs, document metadata, and RAG retrieval private.

**Architecture:** React authenticates with Supabase and sends the access token to Render. Render verifies JWTs, turns them into a trusted `CurrentUser`, and passes only that id into every document/retrieval operation. PDFs live in a private Supabase bucket; Postgres stores owner-scoped metadata and chunks.

**Tech Stack:** React, TypeScript, Vite, FastAPI, psycopg2, PyJWT, Supabase Auth/Storage/Postgres, Vitest, pytest.

## Global Constraints

- No unauthenticated document, upload, delete, or query request succeeds.
- Browser receives only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Service-role and database credentials remain exclusively on Render.
- The current dashboard changes remain intact.

---

### Task 1: Create private Supabase schema and production settings

**Files:**
- Create: `supabase/migrations/20260713_auth_private_library.sql`
- Create: `backend/tests/test_auth_migration.py`
- Modify: `backend/app/core/config.py`
- Modify: `backend/pyproject.toml`
- Create: `docs/deployment-auth.md`

**Interfaces:**
- Produces private bucket `study-documents`, `documents.owner_id`, `documents.storage_path`, per-owner file hash uniqueness, and RLS policies.

- [ ] **Step 1: Write the failing migration contract test**

```python
def test_migration_declares_private_owner_model():
    sql = Path('supabase/migrations/20260713_auth_private_library.sql').read_text()
    assert 'owner_id UUID NOT NULL REFERENCES auth.users(id)' in sql
    assert 'ENABLE ROW LEVEL SECURITY' in sql
    assert "study-documents" in sql
```

- [ ] **Step 2: Run red**

Run: `cd backend && .venv/bin/pytest tests/test_auth_migration.py -q`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Write the migration and settings**

```sql
alter table public.documents add column owner_id uuid references auth.users(id);
alter table public.documents add column storage_path text;
alter table public.documents alter column owner_id set not null;
alter table public.documents alter column storage_path set not null;
alter table public.documents add constraint documents_owner_file_hash_key unique (owner_id, file_hash);
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
create policy "owner documents" on public.documents for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
insert into storage.buckets (id, name, public) values ('study-documents', 'study-documents', false) on conflict (id) do nothing;
```

```python
SUPABASE_URL: str = ''
SUPABASE_SERVICE_ROLE_KEY: str = ''
SUPABASE_JWT_ISSUER: str = ''
SUPABASE_JWT_AUDIENCE: str = 'authenticated'
```

- [ ] **Step 4: Run green**

Run: `cd backend && .venv/bin/pytest tests/test_auth_migration.py -q`

Expected: PASS.

### Task 2: Add Render JWT verification

**Files:**
- Create: `backend/app/core/auth.py`
- Create: `backend/tests/test_auth.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Produces `CurrentUser(id: str, email: str | None)` and `get_current_user` FastAPI dependency.

- [ ] **Step 1: Write failing token tests**

```python
@pytest.mark.asyncio
async def test_list_documents_rejects_missing_bearer_token(client):
    assert (await client.get('/api/v1/documents')).status_code == 401

def test_token_with_wrong_issuer_is_rejected():
    with pytest.raises(HTTPException) as error:
        decode_supabase_token('wrong-issuer-token')
    assert error.value.status_code == 401
```

- [ ] **Step 2: Run red**

Run: `cd backend && .venv/bin/pytest tests/test_auth.py -q`

Expected: FAIL because no authentication dependency exists.

- [ ] **Step 3: Implement current-user extraction and exact CORS**

```python
@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None

async def get_current_user(authorization: Annotated[str | None, Header()] = None) -> CurrentUser:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Authentication required.')
    claims = decode_supabase_token(authorization.removeprefix('Bearer '))
    return CurrentUser(id=claims['sub'], email=claims.get('email'))
```

```python
app.add_middleware(CORSMiddleware, allow_origins=settings.FRONTEND_ORIGINS, allow_credentials=False, allow_methods=['GET', 'POST', 'DELETE'], allow_headers=['Authorization', 'Content-Type'])
```

- [ ] **Step 4: Run green**

Run: `cd backend && .venv/bin/pytest tests/test_auth.py -q`

Expected: PASS.

### Task 3: Scope storage, documents, and retrieval by owner

**Files:**
- Create: `backend/app/services/storage.py`
- Modify: `backend/app/db/supabase.py`
- Modify: `backend/app/api/routes/ingest.py`
- Modify: `backend/app/api/routes/query.py`
- Modify: `backend/tests/test_ingest.py`
- Modify: `backend/tests/test_retrieval.py`

**Interfaces:**
- Repository methods require `owner_id`: `list_documents`, `get_document_by_hash`, `has_ready_documents`, `search`, and `delete_document`.

- [ ] **Step 1: Write failing cross-user tests**

```python
def test_user_a_cannot_list_user_b_documents(repository):
    repository.save_document_metadata({**ready_document, 'id': 'a-doc', 'owner_id': 'user-a', 'storage_path': 'user-a/a-doc/a.pdf'})
    repository.save_document_metadata({**ready_document, 'id': 'b-doc', 'owner_id': 'user-b', 'storage_path': 'user-b/b-doc/b.pdf'})
    assert [item['id'] for item in repository.list_documents('user-a')] == ['a-doc']
```

- [ ] **Step 2: Run red**

Run: `cd backend && .venv/bin/pytest tests/test_ingest.py tests/test_retrieval.py -q`

Expected: FAIL because repository methods are global.

- [ ] **Step 3: Add owner filtering and private object persistence**

```python
where_clauses = ['d.status = %s', 'd.owner_id = %s']
params = ['ready', owner_id]
```

```python
storage_path = private_storage.put_pdf(owner_id=current_user.id, document_id=document_id, filename=file.filename, content=pdf_bytes)
storage_repo.save_document_metadata({**doc_meta, 'owner_id': current_user.id, 'storage_path': storage_path})
```

- [ ] **Step 4: Require current user on every protected route**

```python
@router.get('/documents')
async def get_documents(current_user: Annotated[CurrentUser, Depends(get_current_user)]):
    return storage_repo.list_documents(current_user.id)
```

- [ ] **Step 5: Run green**

Run: `cd backend && .venv/bin/pytest tests/test_auth.py tests/test_ingest.py tests/test_retrieval.py -q`

Expected: PASS.

### Task 4: Build Supabase login and auth-gated StudyRAG frontend

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/services/supabase.ts`
- Create: `frontend/src/auth/AuthProvider.tsx`
- Create: `frontend/src/auth/AuthScreen.tsx`
- Create: `frontend/src/auth/auth.css`
- Modify: `frontend/src/app/main.tsx`
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/components/common/Header.tsx`
- Create: `frontend/tests/AuthScreen.test.tsx`

**Interfaces:**
- Produces `useAuth()` and an `AuthGate` that renders the app only with a Supabase user.

- [ ] **Step 1: Write failing guest-gate test**

```tsx
it('hides StudyRAG for a signed-out visitor', () => {
  render(<AuthGate><App /></AuthGate>);
  expect(screen.getByRole('heading', { name: /Đăng nhập/i })).toBeInTheDocument();
  expect(screen.queryByText(/Hôm nay mình học gì/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run red**

Run: `cd frontend && env NODE_ENV=test npm test -- --run tests/AuthScreen.test.tsx`

Expected: FAIL because the auth gate does not exist.

- [ ] **Step 3: Install client and implement session state**

```bash
npm install @supabase/supabase-js
```

```ts
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
```

```tsx
if (loading) return <div role="status">Đang khôi phục phiên đăng nhập…</div>;
if (!user) return <AuthScreen />;
return <>{children}</>;
```

- [ ] **Step 4: Add bearer token to each API request and sign-out cleanup**

```ts
const { data: { session } } = await supabase.auth.getSession();
const headers = session ? { Authorization: `Bearer ${session.access_token}` } : {};
```

```tsx
const handleSignOut = async () => { setDocuments([]); setChatDraft(''); await signOut(); };
```

- [ ] **Step 5: Run green**

Run: `cd frontend && env NODE_ENV=test npm test -- --run tests/AuthScreen.test.tsx tests/App.test.tsx`

Expected: PASS.

### Task 5: Verify deployment and two-user isolation

**Files:**
- Modify: `README.md`
- Modify: `docs/deployment-auth.md`

**Interfaces:**
- Documents Vercel variables, Render secrets, Supabase Google provider settings, redirect URLs, and private-bucket policies.

- [ ] **Step 1: Document exact environment split**

```text
Vercel: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL
Render: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, SUPABASE_JWT_ISSUER, SUPABASE_JWT_AUDIENCE, FRONTEND_ORIGINS
Supabase Dashboard: Google client id/secret and Vercel redirect URLs
```

- [ ] **Step 2: Run full checks**

Run: `cd backend && .venv/bin/pytest -q && cd ../frontend && env NODE_ENV=test npm test -- --run && npm run build`

Expected: backend tests, frontend tests, TypeScript, and Vite build all pass.

- [ ] **Step 3: Run manual deployed acceptance**

```text
Create User A by email and User B by Google. Upload one PDF as A. Verify B cannot list, retrieve, query, or delete A's data. Reset A's password and confirm A's private PDF remains. Confirm the Storage bucket has no public object URL.
```

- [ ] **Step 4: Commit from a writable Git checkout**

```bash
git add supabase backend frontend docs README.md
git commit -m "feat: add private supabase study library"
```
