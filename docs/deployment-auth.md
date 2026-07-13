# Deploying the private Supabase document library

> Owner action required: this guide is a reproducible handoff only. Do not
> create a Supabase, Vercel, Render, or Google Cloud resource, deploy the app,
> or enter any secret until the account owner has approved and is performing
> that action.

## Deployment order

1. Create or select the Supabase project owned by the deployment account.
2. Apply the migration below and confirm the private bucket and RLS policies.
3. Configure Email and Google authentication in Supabase, including the final
   Vercel URLs.
4. Deploy the backend to Render with server-side secrets and restrict CORS.
5. Deploy the frontend to Vercel with browser-safe variables only.
6. Complete the manual isolation and expiry checks before sharing the URL.

## Apply the migration

Apply `supabase/migrations/20260713_auth_private_library.sql` before deploying
the authenticated backend. Either paste its full contents into the Supabase SQL
Editor and select **Run**, or use the Supabase CLI from the repository root:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

The migration creates the `study-documents` Storage bucket with `public =
false`; do not make this bucket public. Private object keys must begin with the
authenticated user's UUID (`<user_id>/<document_id>/<filename>.pdf`) so the
Storage policy can limit access to that user.

The migration intentionally stops if either legacy `public.documents` or
`public.document_chunks` already exists, with `Legacy documents must be assigned
or removed manually`. It never guesses an owner, deletes data, or alters the
old global schema. Resolve, archive, or migrate that schema with a separately
reviewed migration before applying this bootstrap migration to a clean project.

The Render backend only validates this versioned schema at startup; it never
creates tables or switches a configured PostgreSQL/Supabase deployment to local
JSONL. If the database or migration is unavailable, `GET /api/v1/ready` returns
`503` with `database: postgres_unready` and the migration path. Fix readiness
before enabling uploads or sharing the deployment. JSONL is a local-development
mode only, selected by a non-PostgreSQL `DATABASE_URL` and
`VECTOR_STORE_TYPE=sqlite_chroma`.

## Environment variables

### Vercel (frontend)

Set these production variables in Vercel. `VITE_*` values are compiled into the
browser bundle, so only the public Supabase URL and anonymous key belong here.

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
VITE_API_BASE_URL=https://<render-service>.onrender.com/api/v1
```

Redeploy the frontend after changing any `VITE_*` value. Do not place the
Supabase service-role key, database password, or another server secret in
Vercel's frontend variables.

### Render (backend)

Configure these as Render secrets (or the equivalent server-side secret store):

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-secret>
DATABASE_URL=postgresql://...
SUPABASE_JWT_ISSUER=https://<project-ref>.supabase.co/auth/v1
SUPABASE_JWT_AUDIENCE=authenticated
FRONTEND_ORIGINS=https://<vercel-project>.vercel.app,https://<custom-domain>
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be included in a
Vite `VITE_*` variable, frontend source, or client-side deployment setting.
`FRONTEND_ORIGINS` accepts either a comma-separated allowlist or a JSON array,
for example `https://study.example.com,https://preview.example.com` or
`["https://study.example.com", "https://preview.example.com"]`. The backend
rejects malformed values, wildcard origins, paths, credentials, query strings,
and fragments; it never falls back to `*`. Keep credentials disabled because
the API uses bearer tokens.

## Supabase and Google configuration

In the Supabase dashboard, the account owner must:

1. Confirm the `study-documents` bucket is private and that its policies came
   from the migration. Do not add a public bucket policy or generate permanent
   public URLs for study PDFs.
2. Enable the Email provider, turn on **Confirm email**, and configure the
   production Site URL. Protected API calls verify the signed access JWT and
   then retrieve the bearer identity from Supabase Auth using the backend-only
   service-role key. Access is allowed only when that authoritative user record
   has `email_confirmed_at`; this supports confirmed Google OAuth identities
   without depending on a custom access-token claim.
3. Enable the Google provider and enter the Google OAuth client ID and client
   secret created by the owner. The application must never store either value
   in this repository or a Vercel variable.
4. Add the production Vercel URL (and any approved custom domain) to Supabase
   Redirect URLs. Add the same authorized callback/origin in Google Cloud.
5. Set the Supabase Site URL to the final production frontend URL.

The app uses `window.location.origin` for email-confirmation, password-reset,
and Google OAuth returns. The Site URL and Redirect URLs must therefore match
every approved frontend origin exactly, including `https`.

## Manual production validation

Use two fresh accounts and a private browser context so each check is
independent. Record the timestamp, account type, endpoint/UI action, and the
observed status code or screen for the release handoff.

1. Create Email **User A**, confirm the email, sign in, and upload one PDF.
   Confirm the document appears only in A's library and can be queried by A.
2. Create Google **User B** with the Google provider, then sign in as B in a
   separate browser profile. Confirm B's library is empty.
3. While authenticated as B, attempt to list, query, and delete A's document
   through the normal UI and, where practical, the protected API with B's
   bearer token. Each action must return no A-owned data; deleting A's document
   must be rejected (the API returns `404` to avoid disclosing its existence).
4. Sign back in as A and confirm A's PDF still exists and can be queried. This
   proves B's rejected delete did not alter it.
5. Use **Quên mật khẩu?** for User A and complete the email reset flow. Confirm
   its return URL stays on an approved Vercel origin and the new password works.
6. Expire or remove the active browser session (for example, sign out in
   Supabase or clear the local auth session), then trigger a protected request
   by waiting for the dashboard refresh. The app must return to **Chào mừng trở
   lại** and show no private document name or count.
7. Inspect the uploaded object in the Supabase Storage dashboard and browser
   network requests. The bucket must remain private; no permanent public
   Storage URL may be available. Access must require the authenticated policy
   path or a deliberately short-lived, owner-authorized signed URL if one is
   added in a separately reviewed change.

## Local and CI verification before handoff

Run these without production credentials or cloud configuration:

```bash
cd backend && .venv/bin/pytest -q
cd frontend && env NODE_ENV=test npm test -- --run
npm run build
```

For the responsive check, run `npm run dev -- --host 0.0.0.0` and inspect the
authenticated UI at 1440px, 1024px, 390px, and 320px. Verify the sidebar becomes
the bottom navigation, long filenames and email addresses do not overflow, and
the mobile composer stays above the tab bar. Stop the local server after the
inspection.
