# Supabase Auth and Private Study Library

## Goal

Turn StudyRAG into a public multi-user app: anyone can register with email/password or Google, but only authenticated users may upload PDFs, ask AI questions, and view or delete their own saved exam library.

## Scope

- Add email/password sign-up, sign-in, email confirmation, password reset, sign-out, and Google OAuth through Supabase Auth.
- Use a frontend auth session to gate every StudyRAG screen except the public auth pages.
- Require and verify a Supabase access token on all Render endpoints that list, upload, delete, or query documents.
- Store PDFs in a private Supabase Storage bucket and document/chunk metadata in Supabase Postgres, all owned by one authenticated user.
- Migrate current document and retrieval operations to filter by the authenticated `user_id`.
- Provide deployment configuration for Vercel, Render, Supabase, and Google OAuth.

## Non-goals

- No social profiles, teams, roles, payment, quota/billing, or admin console.
- No anonymous upload, guest querying, shared documents, or public file links.
- No migration of existing local JSONL/SQLite documents into a user account.
- No persisted chat-conversation history in this scope; “lưu đề” means persisted uploaded PDFs and their metadata.

## Chosen Architecture

### Authentication

- The React client uses `@supabase/supabase-js` with only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- The login screen offers two equal actions: email/password and “Tiếp tục với Google”.
- Public sign-up is enabled. Email/password accounts must confirm their email before gaining an active session; the app provides a resend-confirmation and password-reset route.
- Google identity provider configuration, redirect URLs, and production site URL are configured in Supabase Dashboard; no Google client secret appears in source code, Vercel, or the browser.

### API Trust Boundary

1. The browser obtains a Supabase access token after login.
2. The API client attaches `Authorization: Bearer <access_token>` to every protected request.
3. Render verifies the JWT signature and required Supabase issuer/audience on each protected route, then exposes a trusted `CurrentUser(id, email)` dependency.
4. Route handlers pass `CurrentUser.id` to repository methods; the repository never accepts an arbitrary user id from a request body or query string.
5. Missing, expired, malformed, or invalid tokens return HTTP 401. A valid token trying to access another user's document returns HTTP 404, avoiding ownership disclosure.

### Private Storage and Data Model

- Supabase Storage bucket: `study-documents`, marked private.
- Object key: `<user_id>/<document_id>/<sanitized-original-filename>.pdf`.
- Render receives the authenticated multipart upload, validates and parses it as today, writes the original bytes to the private bucket using its server-only service-role key, and saves the object key in Postgres.
- `documents` gains `owner_id UUID NOT NULL REFERENCES auth.users(id)` and `storage_path TEXT NOT NULL`.
- The uniqueness rule becomes `(owner_id, file_hash)`, so two users can save the same PDF while one user cannot duplicate their own copy.
- `document_chunks` remains owned through `document_id`; all search SQL joins `documents` and filters `documents.owner_id = current_user.id` before scoring or limiting results.
- Row Level Security is enabled on `documents` and `document_chunks`. Browser-side policies allow a user to access only rows with `owner_id = auth.uid()`. Render still performs an explicit owner filter because its server connection is privileged.
- Storage policies permit authenticated users to access only objects where the first folder segment equals `auth.uid()`. The browser does not receive a public URL.

## User Experience

### Guest

- Landing screen uses the approved Clean Study Canvas auth surface with sign-in, sign-up, Google, password reset, validation, loading, and clear error states.
- Guest cannot navigate to Library or Chat. A direct route or stale app tab redirects to sign-in and preserves the intended destination only after a successful session.

### Signed-in user

- Header shows account email/avatar and a sign-out action.
- Dashboard, Library, and Chat show only that account's documents and retrieval results.
- Uploading persists a private PDF and its indexed data. Deleting a document removes its Postgres metadata/chunks and the matching private Storage object.
- When a session expires, protected API responses move the UI back to sign-in without leaving stale documents on screen.

## Frontend Components

- `supabaseClient`: singleton client created from Vite public variables.
- `AuthProvider`: exposes session, current user, loading state, sign-in/up, Google OAuth, reset password, and sign-out.
- `AuthGate`: renders auth UI until a confirmed session exists, then renders the existing app shell.
- `AuthScreen`: login/sign-up/reset views with the approved Clean Study Canvas visual language.
- `apiService`: obtains the current token for every protected request and maps 401 to a dedicated unauthenticated response.
- `App`: clears document and chat draft state on sign-out or session loss, then refetches the private library after sign-in.

## Backend Components

- Authentication dependency validates Supabase JWTs from issuer/JWKS settings and returns the current user.
- Ingest, list documents, delete document, and query routes require the dependency.
- Repository methods require `owner_id` for every metadata lookup, list, ready-document guard, chunk search, and deletion.
- A storage service uploads/downloads/deletes private Supabase Storage objects using only `SUPABASE_SERVICE_ROLE_KEY` on Render.
- Database initialization is replaced by versioned SQL migration(s) suitable for Supabase SQL Editor or CLI; production startup must not silently fall back to local JSONL after a Postgres failure.

## Error Handling

- 401: session absent/expired/invalid; frontend clears private state and shows sign-in.
- 403 is reserved for authentication configuration failures; normal ownership mismatches use 404.
- Email confirmation pending: show a resend action, never falsely present the account as logged in.
- Google OAuth cancellation or provider error: retain the form and show a recoverable message.
- Upload failure after storage write: backend deletes the newly written object if metadata/chunk persistence fails.
- Deletion failure: return an error without telling the UI that the document disappeared.

## Security Constraints

- Keep `SUPABASE_SERVICE_ROLE_KEY`, direct database password, JWT verifier secrets, and Google client secret out of Vercel and out of Git.
- Vercel receives only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_BASE_URL`.
- Render receives `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `SUPABASE_JWT_ISSUER`, `SUPABASE_JWT_AUDIENCE`, and the Vercel frontend origin.
- Replace permissive CORS with the configured Vercel origin(s); keep credentials disabled because the API uses bearer tokens.
- Do not trust owner ids, Storage paths, or document ids supplied by the browser without current-user filtering.

## Deployment Setup

1. Create Supabase project, private `study-documents` bucket, migration, RLS policies, and Google provider credentials.
2. Add Vercel production and preview redirect URLs plus the final Vercel site URL in Supabase Auth settings.
3. Add Vercel public environment variables and deploy frontend.
4. Add Render secret environment variables, set the exact Vercel CORS origin, and deploy backend.
5. Test sign-up confirmation, Google login, two-user isolation, upload/query/delete lifecycle, password reset, and expired-session handling against deployed URLs.

## Acceptance Criteria

1. A guest cannot upload, list, delete, or query documents through the UI or API.
2. A public user can register with verified email/password or Google and then use the app.
3. User A cannot list, retrieve, query, download, or delete User B's documents, chunks, or PDFs.
4. An uploaded PDF stays available after Render restarts because it is private Supabase Storage data.
5. The deployed Vercel frontend and Render API use no exposed server-only secret.
6. Auth and ownership behavior are covered by frontend and backend tests, including negative cross-user cases.
