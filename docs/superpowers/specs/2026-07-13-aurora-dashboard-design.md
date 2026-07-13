# Aurora AI Focus Hero Dashboard

## Goal

Replace StudyRAG's current dense, demo-heavy dashboard with a modern Aurora AI dashboard that makes asking a grounded question the clearest first action. The redesign must keep the existing API contract and navigation model intact.

## Scope

- Redesign the dashboard rendered by `activeTab === 'dashboard'`.
- Refresh the shared header styling only as needed to make the dashboard feel like one product.
- Reuse current connection, document, and tab state from `App`.
- Add a dashboard question field that opens the existing AI chat with its text preserved in the chat composer.
- Add responsive, empty, checking, connected, and error presentations.

## Non-goals

- No backend, API, data-model, authentication, or document-ingestion changes.
- No redesign of the Library, Chat, History, or Settings screens beyond the shared header's visual shell.
- No fake lesson progress, milestones, or fabricated AI response preview on the dashboard.

## Chosen Direction

**Aurora AI + Focus Hero.** The screen uses a deep blue-black base with restrained violet and mint aurora glows. It avoids stacked glass cards, loud gradients, and decorative metrics. The focus is a single prompt: *"Hôm nay mình học gì?"*

## Layout and Visual System

### Header

- Keep the current navigation destinations and connection refresh action.
- Use a compact dark shell, a crisp wordmark, an active-nav underline/pill, and a small connection indicator.
- Preserve keyboard focus visibility and all existing labels.

### Dashboard

1. **Context line:** current date and a subtle availability indicator.
2. **Focus hero:** headline, short promise about source-grounded answers, and the dashboard question field.
3. **Primary action:** pressing Enter or clicking the arrow switches to the Chat tab while carrying the question text into the chat composer; it does not auto-submit.
4. **Support cards:**
   - *Tiếp tục học*: a lightweight route back to Chat with a suggested prompt.
   - *Thư viện*: the real count of documents currently available; routes to Library.
5. **Status strip:** only shown when the API is checking or unavailable, with a retry action for an error.

### Responsive behavior

- Desktop: hero stays wide; two support cards appear in a two-column row.
- Tablet: horizontal padding and type scale reduce without changing hierarchy.
- Mobile: nav scrolls or compresses safely; hero controls and support cards stack; all touch targets remain at least 44px high.

## Component and Data Changes

| Area | Change | Existing dependency |
| --- | --- | --- |
| `App` | Replace the dashboard markup; keep document and connection polling logic. | `documents`, `connectionState`, `errorMessage`, `setActiveTab` |
| `App` | Hold a short-lived chat draft when a dashboard action starts a question. | React state only |
| `ChatPanel` | Accept an optional draft prop and place it in its existing textarea when it changes. | Existing input state |
| `Header` / header styles | Visual-only refinement; preserve navigation handlers and refresh control. | Existing props |
| CSS | Add dashboard-scoped Aurora tokens and component classes; remove dashboard inline styling. | Existing CSS import path |

## States and Error Handling

- **Checking:** status strip says the API is being checked; the question action remains visually clear but disabled until connected.
- **Connected with documents:** show the document count and enable the question action.
- **Connected without documents:** show zero documents; route the user to Library with a clear upload prompt instead of pretending AI can answer.
- **Error:** show the current error summary and a retry control wired to `checkConnection`.
- **Draft transfer:** if no document is ready, the dashboard action opens Library rather than Chat; otherwise it opens Chat with the draft preserved.

## Accessibility

- Use a real form, label, button, and descriptive disabled state for the question field.
- Keep sufficient contrast for violet/mint accents on the dark surface.
- Preserve visible focus rings and semantic nav labels.
- Do not communicate connection state only by color.

## Verification

- Add or update frontend tests for the hero heading, document count, API-error retry control, and dashboard-to-chat draft transfer.
- Run `npm test -- --run` and `npm run build` from `frontend/`.
- Manually verify desktop and narrow mobile layouts using the Vite app.

## Acceptance Criteria

1. The dashboard has Aurora AI styling and is visibly simpler than the current demo/milestone layout.
2. The question field is the primary interaction and transfers its text to Chat without an API change.
3. The document count reflects the loaded document list rather than hard-coded data.
4. Empty, checking, connected, and error states are understandable and actionable.
5. Existing tab navigation, health checks, and document retrieval continue to work.
