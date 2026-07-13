# Clean Study Canvas UI System

## Goal

Apply one modern, light, mobile-first visual system across StudyRAG's public authentication, authenticated dashboard, private library, AI chat, and account controls. The design supports the already-approved Supabase authentication and private-document architecture; it does not alter those security decisions.

## Chosen Direction

**Clean Study Canvas** is the selected third concept: a light canvas, cobalt blue as the action color, soft blue surfaces, readable dark text, and generous whitespace. It must feel like a focused study workspace rather than a generic dark AI dashboard.

### Visual Tokens

- Canvas: cool white and pale blue (`#F1F5FF`, `#F8FAFF`); cards are white with subtle blue-gray borders.
- Primary action: cobalt (`#3150E8`); its light tint is used for the active navigation item and informative surfaces.
- Text: navy (`#17213D`) for headings, slate-blue (`#64718C`) for secondary content, and accessible contrast for all interactive states.
- Type: the existing system/Inter-style sans serif. Large, short headings; regular 14–16px body text; no condensed display font.
- Shape and motion: 10–16px corner radius, soft elevation on cards, and only short hover/focus transitions. There are no decorative gradients, persistent animation, or fabricated activity metrics.

## Product Shell and Navigation

### Desktop and tablet

- Authenticated views use a top bar with the StudyRAG mark, current context, account avatar/menu, and sign-out.
- A left sidebar provides **Tổng quan**, **Thư viện**, **Hỏi AI**, and **Cài đặt**. The active route uses a pale-blue background plus cobalt text; inactive items are quiet but readable.
- Main content has one clear page title and primary action. The shell remains usable down to tablet width; the sidebar can reduce labels only when needed.

### Mobile

- The sidebar is removed, not squeezed into the page.
- A fixed bottom bar exposes four destinations: Tổng quan, Thư viện, Hỏi AI, Hồ sơ. It preserves enough lower-page padding so it never covers a composer or upload action.
- Each screen keeps one dominant action above the fold: ask a question, upload a PDF, or submit the sign-in form.

## Screens and Flows

### Public authentication

- The public surface is a compact, centered card on a pale-blue page. It contains email/password fields, a primary submit action, an equal Google action, and links to switch between sign-in, sign-up, and password reset.
- Sign-up clearly tells the user to verify email. Loading disables the submitted action; form, provider, and network errors appear next to the relevant action in plain Vietnamese.
- A signed-out user who requests Library or Chat sees this screen and returns to the intended private screen only after a valid session.

### Dashboard

- The opening view starts with the question “Hôm nay mình học gì?” and a prominent quick-question field.
- It presents only real private-document counts and useful next actions. If there are no PDFs, the primary action leads to the Library upload surface; it does not pretend that a study streak or recommendation exists.
- A submitted quick question transfers to the Chat composer with the question retained. Connection, loading, empty, and retry states use the same card language.

### Private library

- The page has a title, a compact description of private storage, and a primary **Tải tài liệu lên** action.
- The upload dropzone accepts only the supported PDF workflow. Its idle, drag-over, uploading, success, duplicate, and error states are explicit.
- Document rows show filename, indexing status, lightweight metadata, and an overflow/delete action. The empty state explains that PDFs become available only after upload; deleting requires confirmation and then updates the private list.

### AI chat

- Chat shows the selected private-document context, the conversation, source references already supplied by the backend, and a bottom composer.
- User messages use cobalt bubbles; assistant answers sit on a quiet blue-gray surface. The composer is visually fixed at the bottom of the chat panel without obstructing content on mobile.
- Before a ready document exists, the page explains the next step and offers navigation to upload. Sending, retrieval, timeout, authentication-expiry, and server-error states preserve the typed question where safe.

### Account settings

- The profile destination keeps scope narrow: email/avatar identity, sign-out, and links for password reset or account-provider context.
- It deliberately excludes social profiles, plans, usage analytics, chat history, or a broad settings console.

## Component Boundaries

- `AppShell` owns responsive navigation and top bar only; it does not own fetching or auth decisions.
- `AuthGate` decides public versus private routing. `AuthScreen` contains form state and accessible form feedback.
- `Dashboard`, `LibraryPage`, `ChatPanel`, and `AccountPage` receive focused data/action props rather than reaching across pages.
- Shared `PageHeader`, `EmptyState`, `InlineAlert`, `PrimaryButton`, `StatusBadge`, and `ConfirmDialog` prevent visual and behavioral drift.
- The API/auth layer remains separate from presentation. UI components never receive or display server-only credentials or arbitrary owner IDs.

## States, Accessibility, and Quality Bar

- Every network action has pending, success, empty, and failure feedback. Skeletons are used only while a known layout is loading; they do not replace useful empty-state copy.
- Focus rings, keyboard operation, visible form labels, semantic buttons, status announcements, and color-independent status text are required.
- Desktop targets are verified at 1440px and 1024px; mobile targets at 390px and 320px. Long Vietnamese filenames, long account emails, and multi-line AI responses must not overflow.
- The signed-out shell, auth forms, empty library, upload progress/error, document deletion, no-ready-document chat, auth expiry, and API failure are covered by component or integration tests.

## Non-goals

- No dark-theme toggle in this release.
- No custom illustration assets, mascots, fake learning analytics, notifications center, or persisted chat history.
- No redesign of ingestion, retrieval, authentication, storage, or database authorization beyond the integration points documented in the auth/private-library design.

## Acceptance Criteria

1. Login, Dashboard, Library, Chat, and Account visibly use the same Clean Study Canvas tokens and shared components.
2. Desktop navigation becomes a usable mobile bottom bar without hiding page actions or the chat composer.
3. The UI never suggests documents, statistics, recommendations, or authentication that the backend has not actually supplied.
4. Guest, loading, empty, validation, success, expiry, and error states are understandable in Vietnamese and keyboard accessible.
5. The product remains responsive and readable at the specified desktop and mobile widths.
