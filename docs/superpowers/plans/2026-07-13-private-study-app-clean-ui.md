# Private StudyRAG and Clean Study Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require Supabase login before StudyRAG use, keep each user's PDFs and RAG results private, and rebuild every public and private screen in the approved Clean Study Canvas system.

**Architecture:** The Vite client authenticates through Supabase and sends its access token to FastAPI. FastAPI verifies that token, converts it to a trusted current user, and passes only that id into an owner-scoped PostgreSQL repository and private Supabase Storage service. The frontend separates session state, responsive shell, page components, and API calls so that the same data/security flow drives the dashboard, library, and chat.

**Tech Stack:** React, TypeScript, Vite, Vitest, `@supabase/supabase-js`, FastAPI, SQLModel/psycopg2, PyJWT with crypto support, httpx, Supabase Auth/Storage/Postgres, pytest.

## Global Constraints

- The visual system is Clean Study Canvas: canvas `#F1F5FF`, primary cobalt `#3150E8`, text `#17213D`, and readable Vietnamese copy.
- The authenticated desktop shell has a sidebar; the mobile shell has a fixed bottom bar and enough bottom padding for the chat composer.
- No unauthenticated request may list, upload, delete, or query documents.
- Browser variables are limited to `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_BASE_URL`; service-role/database secrets stay on Render only.
- The private bucket is `study-documents`; object keys are `<user_id>/<document_id>/<sanitized-filename>.pdf` and never become public URLs.
- Repository methods receive an authenticated `owner_id`; the browser never supplies an owner id or storage path.
- Keep the existing PDF extraction/retrieval behavior. Do not migrate or delete existing user data automatically; the migration must halt if legacy global documents exist.
- Run frontend tests with `env NODE_ENV=test npm test -- --run` because this host currently exports `NODE_ENV=production`.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `supabase/migrations/20260713_auth_private_library.sql` | Safe schema/bucket/RLS setup for private documents. |
| `backend/app/core/auth.py` | Supabase JWT validation and `CurrentUser` dependency. |
| `backend/app/services/private_storage.py` | Server-only private PDF put/delete calls. |
| `backend/app/db/supabase.py` | Owner-scoped document/chunk SQL and metadata lifecycle. |
| `frontend/src/auth/*` | Supabase browser client, session provider, and public auth UI. |
| `frontend/src/components/common/AppShell.tsx` | Responsive authenticated navigation and account controls. |
| `frontend/src/components/dashboard/Dashboard.tsx` | Real-data overview and quick-question flow. |
| `frontend/src/components/library/LibraryPage.tsx` | Upload, private document list, status, and delete confirmation. |
| `frontend/src/components/chat/ChatPanel.tsx` | Private-document AI chat and no-document recovery state. |
| `frontend/src/styles/{tokens,auth,shell,library,chat,dashboard}.css` | Clean Study Canvas tokens and page-specific styles. |
| `docs/deployment-auth.md` | Manual Supabase, Vercel, Render, and Google OAuth setup. |

---

### Task 1: Add safe private-Supabase schema and production configuration

**Files:**
- Create: `supabase/migrations/20260713_auth_private_library.sql`
- Create: `backend/tests/test_auth_migration.py`
- Modify: `backend/app/core/config.py`
- Modify: `backend/pyproject.toml`
- Create: `docs/deployment-auth.md`

**Interfaces:**
- Produces a private `study-documents` bucket and `documents.owner_id`, `documents.storage_path` columns.
- Produces `Settings.SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_ISSUER`, and `SUPABASE_JWT_AUDIENCE`.

- [ ] **Step 1: Write the failing migration/config contract test.**

```python
from pathlib import Path

from app.core.config import Settings


def test_private_migration_has_owner_guard_bucket_and_rls():
    sql = Path('../supabase/migrations/20260713_auth_private_library.sql').read_text()
    assert "raise exception 'Legacy documents must be assigned or removed manually'" in sql
    assert 'owner_id uuid not null references auth.users(id)' in sql.lower()
    assert "'study-documents'" in sql
    assert 'enable row level security' in sql.lower()
    assert 'documents_owner_file_hash_key' in sql


def test_settings_expose_only_server_auth_values():
    settings = Settings(SUPABASE_SERVICE_ROLE_KEY='server-only', SUPABASE_JWT_ISSUER='https://id.supabase.co/auth/v1')
    assert settings.SUPABASE_SERVICE_ROLE_KEY == 'server-only'
    assert settings.SUPABASE_JWT_AUDIENCE == 'authenticated'
```

- [ ] **Step 2: Run the migration contract test and verify it fails because the migration and settings do not exist.**

Run: `cd backend && .venv/bin/pytest tests/test_auth_migration.py -q`

Expected: FAIL with missing migration file and missing settings attributes.

- [ ] **Step 3: Add the minimal safe migration and settings/dependency changes.**

```sql
do $$
begin
  if exists (select 1 from public.documents) then
    raise exception 'Legacy documents must be assigned or removed manually';
  end if;
end $$;

alter table public.documents add column owner_id uuid not null references auth.users(id);
alter table public.documents add column storage_path text not null;
alter table public.documents drop constraint if exists documents_file_hash_key;
alter table public.documents add constraint documents_owner_file_hash_key unique (owner_id, file_hash);
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
insert into storage.buckets (id, name, public) values ('study-documents', 'study-documents', false) on conflict (id) do nothing;
```

```python
SUPABASE_SERVICE_ROLE_KEY: str = ''
SUPABASE_JWT_ISSUER: str = ''
SUPABASE_JWT_AUDIENCE: str = 'authenticated'
```

Add `PyJWT[crypto]` to the backend runtime dependencies and document the SQL Editor/CLI command, required bucket privacy, and the fact that the migration intentionally refuses legacy rows.

- [ ] **Step 4: Run the targeted test and verify it passes.**

Run: `cd backend && .venv/bin/pytest tests/test_auth_migration.py -q`

Expected: PASS.

- [ ] **Step 5: Commit this independently testable schema/configuration task.**

```bash
git add supabase/migrations/20260713_auth_private_library.sql backend/app/core/config.py backend/pyproject.toml backend/tests/test_auth_migration.py docs/deployment-auth.md
git commit -m "feat: add private study library schema"
```

### Task 2: Verify Supabase bearer tokens at the FastAPI boundary

**Files:**
- Create: `backend/app/core/auth.py`
- Create: `backend/tests/test_auth.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Produces `CurrentUser(id: str, email: str | None)` and `get_current_user(authorization) -> CurrentUser`.
- Protected routes consume `current_user: Annotated[CurrentUser, Depends(get_current_user)]`.

- [ ] **Step 1: Write failing authentication tests for missing, malformed, and valid bearer tokens.**

```python
import pytest
from fastapi import HTTPException

from app.core.auth import decode_supabase_token


@pytest.mark.asyncio
async def test_documents_require_a_bearer_token(client):
    response = await client.get('/api/v1/documents')
    assert response.status_code == 401


def test_wrong_issuer_is_rejected(monkeypatch):
    monkeypatch.setattr('app.core.auth._decode_with_jwks', lambda _token: {'sub': 'u1', 'iss': 'wrong'})
    with pytest.raises(HTTPException, match='Invalid authentication token'):
        decode_supabase_token('bad-issuer')
```

- [ ] **Step 2: Run the tests and verify they fail because the auth module and protected dependency are absent.**

Run: `cd backend && .venv/bin/pytest tests/test_auth.py -q`

Expected: FAIL with module import or an unprotected route assertion.

- [ ] **Step 3: Implement issuer/audience validation, a stable user type, and exact CORS.**

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=['GET', 'POST', 'DELETE'],
    allow_headers=['Authorization', 'Content-Type'],
)
```

Use Supabase's JWKS URL derived from `SUPABASE_JWT_ISSUER`; reject missing `sub`, wrong issuer, wrong audience, expired, malformed, and unverifiable tokens with 401.

- [ ] **Step 4: Run the targeted test and verify it passes.**

Run: `cd backend && .venv/bin/pytest tests/test_auth.py -q`

Expected: PASS.

- [ ] **Step 5: Commit this independently testable API trust-boundary task.**

```bash
git add backend/app/core/auth.py backend/app/main.py backend/tests/test_auth.py
git commit -m "feat: verify supabase api tokens"
```

### Task 3: Make document storage, retrieval, and deletion owner-scoped

**Files:**
- Create: `backend/app/services/private_storage.py`
- Modify: `backend/app/db/supabase.py`
- Modify: `backend/app/api/routes/ingest.py`
- Modify: `backend/app/api/routes/query.py`
- Modify: `backend/tests/test_ingest.py`
- Modify: `backend/tests/test_query.py`
- Modify: `backend/tests/test_retrieval.py`

**Interfaces:**
- Produces `PrivateStorage.put_pdf(owner_id, document_id, filename, content) -> str` and `delete_pdf(storage_path) -> None`.
- Makes repository methods accept `owner_id: str`: `list_documents`, `get_document_by_hash`, `has_ready_documents`, `search`, and `delete_document`.

- [ ] **Step 1: Write failing cross-user repository and route tests.**

```python
def test_list_documents_returns_only_the_current_owner(repository, ready_document):
    repository.save_document_metadata({**ready_document, 'id': 'a-doc', 'owner_id': 'user-a', 'storage_path': 'user-a/a-doc/a.pdf'})
    repository.save_document_metadata({**ready_document, 'id': 'b-doc', 'owner_id': 'user-b', 'storage_path': 'user-b/b-doc/b.pdf'})
    assert [item['id'] for item in repository.list_documents('user-a')] == ['a-doc']


@pytest.mark.asyncio
async def test_user_cannot_delete_another_users_document(client, user_a_headers):
    response = await client.delete('/api/v1/documents/user-b-document', headers=user_a_headers)
    assert response.status_code == 404
```

- [ ] **Step 2: Run the affected backend tests and verify they fail because current operations are global.**

Run: `cd backend && .venv/bin/pytest tests/test_ingest.py tests/test_query.py tests/test_retrieval.py -q`

Expected: FAIL because repository methods do not require an owner id.

- [ ] **Step 3: Implement private object persistence and explicit owner filtering throughout the lifecycle.**

```python
def build_path(owner_id: str, document_id: str, filename: str) -> str:
    return f'{owner_id}/{document_id}/{sanitize_filename(filename)}'


def put_pdf(self, owner_id: str, document_id: str, filename: str, content: bytes) -> str:
    storage_path = build_path(owner_id, document_id, filename)
    response = self.client.post(f'{self.base_url}/storage/v1/object/study-documents/{storage_path}', content=content)
    response.raise_for_status()
    return storage_path
```

```python
where_clauses = ['d.status = %s', 'd.owner_id = %s']
params = ['ready', owner_id]
```

Inject `CurrentUser` on every ingest/list/delete/query handler; store the returned storage path with the document metadata; delete the storage object only after finding a document for the same owner; delete a newly uploaded object if metadata/chunk persistence fails.

- [ ] **Step 4: Run authentication and document/retrieval tests and verify they pass.**

Run: `cd backend && .venv/bin/pytest tests/test_auth.py tests/test_ingest.py tests/test_query.py tests/test_retrieval.py -q`

Expected: PASS, including User A/User B isolation cases.

- [ ] **Step 5: Commit this independently testable private-data task.**

```bash
git add backend/app/services/private_storage.py backend/app/db/supabase.py backend/app/api/routes/ingest.py backend/app/api/routes/query.py backend/tests
git commit -m "feat: scope study data to authenticated owners"
```

### Task 4: Establish the Supabase client, public auth views, and Clean Study Canvas tokens

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/services/supabase.ts`
- Create: `frontend/src/auth/AuthProvider.tsx`
- Create: `frontend/src/auth/AuthGate.tsx`
- Create: `frontend/src/auth/AuthScreen.tsx`
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/auth.css`
- Modify: `frontend/src/app/main.tsx`
- Modify: `frontend/src/styles/index.css`
- Create: `frontend/tests/AuthScreen.test.tsx`

**Interfaces:**
- Produces `useAuth()` with `{ session, user, loading, signIn, signUp, signInWithGoogle, resetPassword, signOut }`.
- Produces `AuthGate({ children }: PropsWithChildren)` that renders public auth until a real user exists.

- [ ] **Step 1: Write a failing signed-out/auth-form test.**

```tsx
it('renders the public sign-in screen instead of private navigation when signed out', () => {
  render(<AuthGate><div>private workspace</div></AuthGate>);
  expect(screen.getByRole('heading', { name: /chào mừng trở lại/i })).toBeInTheDocument();
  expect(screen.queryByText('private workspace')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /tiếp tục với google/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and verify it fails because auth components do not exist.**

Run: `cd frontend && env NODE_ENV=test npm test -- --run tests/AuthScreen.test.tsx`

Expected: FAIL with missing module or missing public sign-in heading.

- [ ] **Step 3: Install the public client and implement session-aware auth UI.**

```bash
cd frontend && npm install @supabase/supabase-js
```

```ts
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

```tsx
if (loading) return <div className="auth-loading" role="status">Đang khôi phục phiên đăng nhập…</div>;
if (!user) return <AuthScreen />;
return <>{children}</>;
```

Implement sign-in, public sign-up, email-confirmation pending/resend copy, reset password, Google OAuth redirect, validation, disabled pending submit, and Vietnamese recoverable errors. Replace the dark token definitions with the exact Clean Study Canvas colors and shared focus/alert/button tokens.

- [ ] **Step 4: Run the focused auth test and frontend type/build checks.**

Run: `cd frontend && env NODE_ENV=test npm test -- --run tests/AuthScreen.test.tsx && npm run build`

Expected: PASS and a successful Vite build.

- [ ] **Step 5: Commit this independently testable public-auth foundation.**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/services/supabase.ts frontend/src/auth frontend/src/styles/tokens.css frontend/src/styles/auth.css frontend/src/app/main.tsx frontend/src/styles/index.css frontend/tests/AuthScreen.test.tsx
git commit -m "feat: add clean auth gate"
```

### Task 5: Rebuild the authenticated shell and dashboard with real state

**Files:**
- Create: `frontend/src/components/common/AppShell.tsx`
- Create: `frontend/src/components/common/AccountMenu.tsx`
- Modify: `frontend/src/components/common/Header.tsx`
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/components/dashboard/Dashboard.tsx`
- Modify: `frontend/src/styles/header.css`
- Create: `frontend/src/styles/shell.css`
- Modify: `frontend/src/styles/dashboard.css`
- Modify: `frontend/tests/App.test.tsx`
- Create: `frontend/tests/AppShell.test.tsx`

**Interfaces:**
- Produces `AppShell({ activeTab, onNavigate, children })` with desktop sidebar and mobile bottom navigation.
- `Dashboard` consumes `documents`, `connectionState`, `errorMessage`, `onOpenLibrary`, and `onOpenChat(question)`; it never creates fake counts or study history.

- [ ] **Step 1: Write failing navigation and dashboard-data tests.**

```tsx
it('uses sidebar navigation on desktop and a bottom bar on mobile without duplicate landmark labels', () => {
  render(<AppShell activeTab="dashboard" onNavigate={vi.fn()}><p>content</p></AppShell>);
  expect(screen.getByRole('navigation', { name: /điều hướng chính/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /thư viện/i })).toBeInTheDocument();
});

it('sends a dashboard question to chat without calling the API', () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText(/câu hỏi nhanh/i), { target: { value: 'Tóm tắt định luật Ohm' } });
  fireEvent.click(screen.getByRole('button', { name: /hỏi ai/i }));
  expect(screen.getByRole('textbox', { name: /hỏi ai/i })).toHaveValue('Tóm tắt định luật Ohm');
});
```

- [ ] **Step 2: Run the tests and verify they fail against the old dark/header implementation.**

Run: `cd frontend && env NODE_ENV=test npm test -- --run tests/App.test.tsx tests/AppShell.test.tsx`

Expected: FAIL because `AppShell` and the required navigation semantics do not exist.

- [ ] **Step 3: Implement the responsive private shell and dashboard state rendering.**

```tsx
<AppShell activeTab={activeTab} onNavigate={setActiveTab}>
  {activeTab === 'dashboard' && <Dashboard documents={documents} onOpenLibrary={() => setActiveTab('library')} onOpenChat={openChatWithDraft} />}
</AppShell>
```

```css
@media (max-width: 767px) {
  .app-sidebar { display: none; }
  .mobile-tabbar { display: grid; position: fixed; inset: auto 0 0; }
  .app-main { padding-bottom: 5.5rem; }
}
```

Show a meaningful empty dashboard that routes to Library, a retryable connection error, and only real document counts. Account menu displays the authenticated email/avatar and invokes provider sign-out with document/draft cleanup.

- [ ] **Step 4: Run dashboard/shell tests and the build.**

Run: `cd frontend && env NODE_ENV=test npm test -- --run tests/App.test.tsx tests/AppShell.test.tsx && npm run build`

Expected: PASS and a successful Vite build.

- [ ] **Step 5: Commit this independently testable application shell task.**

```bash
git add frontend/src/components/common frontend/src/app/App.tsx frontend/src/components/dashboard/Dashboard.tsx frontend/src/styles/header.css frontend/src/styles/shell.css frontend/src/styles/dashboard.css frontend/tests/App.test.tsx frontend/tests/AppShell.test.tsx
git commit -m "feat: add clean responsive study shell"
```

### Task 6: Restyle the private library and chat, then attach bearer-authenticated API calls

**Files:**
- Create: `frontend/src/components/library/LibraryPage.tsx`
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/components/library/UploadDropzone.tsx`
- Modify: `frontend/src/components/library/DocumentList.tsx`
- Modify: `frontend/src/components/chat/ChatPanel.tsx`
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/styles/library.css`
- Modify: `frontend/src/styles/chat.css`
- Create: `frontend/tests/LibraryPage.test.tsx`
- Modify: `frontend/tests/ChatPanel.test.tsx`

**Interfaces:**
- `apiService` obtains the current Supabase session token and sends `Authorization: Bearer <token>` for ingest/list/delete/query.
- `LibraryPage({ documents, onDocumentsChanged })` owns upload/list layout; `App` renders it for the Library tab; `ChatPanel` receives only private-document data and `onOpenLibrary`.

- [ ] **Step 1: Write failing private-library and no-ready-document chat tests.**

```tsx
it('shows a useful empty private library and opens a PDF picker', () => {
  render(<LibraryPage documents={[]} onDocumentsChanged={vi.fn()} />);
  expect(screen.getByText(/thư viện của bạn đang trống/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /tải tài liệu lên/i })).toBeInTheDocument();
});

it('sends callers to library when no ready private document exists', () => {
  render(<ChatPanel documents={[]} onOpenLibrary={onOpenLibrary} />);
  fireEvent.click(screen.getByRole('button', { name: /tải tài liệu/i }));
  expect(onOpenLibrary).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the focused tests and verify they fail because the pages still use the legacy dark/inline UI.**

Run: `cd frontend && env NODE_ENV=test npm test -- --run tests/LibraryPage.test.tsx tests/ChatPanel.test.tsx`

Expected: FAIL with missing `LibraryPage` or missing Clean Study Canvas copy/actions.

- [ ] **Step 3: Implement shared card/form/status components through the library, chat, and authenticated API client.**

```ts
export class UnauthenticatedApiError extends Error {
  constructor() {
    super('Authentication required.');
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new UnauthenticatedApiError();
  return { Authorization: `Bearer ${session.access_token}` };
}
```

```tsx
if (!readyDocuments.length) {
  return <EmptyState title="Bạn cần một tài liệu sẵn sàng" actionLabel="Tải tài liệu" onAction={onOpenLibrary} />;
}
```

Replace style props with semantic classes. Keep upload drag-over, file-selected, uploading, success, OCR-required, duplicate, and generic failure states. Add an accessible delete confirmation dialog; render Vietnamese status badges; map a 401 response to cleared private state and the auth screen without showing stale documents.

- [ ] **Step 4: Run focused frontend tests, all frontend tests, and the build.**

Run: `cd frontend && env NODE_ENV=test npm test -- --run tests/LibraryPage.test.tsx tests/ChatPanel.test.tsx && env NODE_ENV=test npm test -- --run && npm run build`

Expected: PASS and a successful Vite build.

- [ ] **Step 5: Commit this independently testable private-workspace UI task.**

```bash
git add frontend/src/components/library frontend/src/components/chat/ChatPanel.tsx frontend/src/app/App.tsx frontend/src/services/api.ts frontend/src/types/index.ts frontend/src/styles/library.css frontend/src/styles/chat.css frontend/tests/LibraryPage.test.tsx frontend/tests/ChatPanel.test.tsx
git commit -m "feat: restyle private library and ai chat"
```

### Task 7: Verify full isolation, responsive UI, and deployment handoff

**Files:**
- Modify: `README.md`
- Modify: `docs/deployment-auth.md`
- Modify: `backend/tests/test_system.py`
- Modify: `frontend/tests/App.test.tsx`

**Interfaces:**
- Produces a reproducible manual deployment checklist and automated cross-user/auth-expiry regression coverage.

- [ ] **Step 1: Add failing end-to-end contract checks for expiration cleanup and no fabricated dashboard data.**

```tsx
it('clears private document content and returns to sign-in after a protected 401', async () => {
  apiService.getDocuments.mockResolvedValueOnce({ data: [{ id: 'private-pdf', status: 'ready' }] });
  apiService.getDocuments.mockResolvedValueOnce({ error: { status: 401, message: 'Authentication required.' } });
  render(<App />);
  await screen.findByText(/1 tài liệu/i);
  await userEvent.click(screen.getByRole('button', { name: /làm mới/i }));
  expect(await screen.findByRole('heading', { name: /chào mừng trở lại/i })).toBeInTheDocument();
  expect(screen.queryByText('private-pdf')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the contract checks and verify they fail until session-expiry cleanup and documentation are complete.**

Run: `cd backend && .venv/bin/pytest tests/test_system.py -q && cd ../frontend && env NODE_ENV=test npm test -- --run tests/App.test.tsx`

Expected: FAIL until the private-state cleanup behavior and final checklist have been added.

- [ ] **Step 3: Complete verification/docs without creating external resources.**

```text
Vercel: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL
Render: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, SUPABASE_JWT_ISSUER, SUPABASE_JWT_AUDIENCE, FRONTEND_ORIGINS
Supabase Dashboard: private study-documents bucket, SQL migration, Google provider client id/secret, Vercel redirect URLs, site URL
```

Document explicit manual validation: create email User A and Google User B, upload as A, confirm B cannot list/query/delete A's PDF, test password reset, expire a browser session, and inspect that no public Storage URL exists. Include Vercel/Render variables but do not deploy or configure them without the account owner's authority.

- [ ] **Step 4: Run all automated checks.**

Run: `cd backend && .venv/bin/pytest -q && cd ../frontend && env NODE_ENV=test npm test -- --run && npm run build`

Expected: all backend tests, all frontend tests, TypeScript checking, and Vite build pass.

- [ ] **Step 5: Manually inspect responsive layouts before final handoff.**

Run: `cd frontend && npm run dev -- --host 0.0.0.0`

Expected: inspect 1440px, 1024px, 390px, and 320px widths; sidebar becomes bottom navigation, long filenames/email do not overflow, and the mobile composer remains above the tab bar.

- [ ] **Step 6: Commit final verification and handoff documentation.**

```bash
git add README.md docs/deployment-auth.md backend/tests/test_system.py frontend/tests/App.test.tsx
git commit -m "docs: add private studyrag deployment guide"
```

## Plan Self-Review

- **Spec coverage:** Tasks 1–3 cover the private-storage/JWT/RLS backend; Task 4 covers public email/Google auth; Tasks 5–6 cover every selected Clean Study Canvas screen, responsive navigation, and visual/error states; Task 7 covers expiry, deployment setup, two-user isolation, and responsive checks.
- **Completeness scan:** The plan has no unfinished markers, deferred coding steps, or vague error-handling instruction. External Supabase/Vercel/Render configuration is intentionally documented as a user-authorized manual operation.
- **Type consistency:** `CurrentUser.id` feeds `owner_id` exactly; `AuthGate` owns public/private access; `AppShell` owns navigation only; `LibraryPage` and `ChatPanel` consume focused props; all protected browser calls use `authHeaders()`.
