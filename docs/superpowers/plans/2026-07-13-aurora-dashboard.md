# Aurora AI Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace StudyRAG's dense dashboard with an Aurora AI focus hero that moves a grounded question into Chat.

**Architecture:** Keep API polling and navigation state in `App`. Extract dashboard rendering to a presentational component; it receives state and callbacks. `App` holds a chat draft, which `ChatPanel` copies into its existing controlled composer without submitting a query.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, CSS, lucide-react.

## Global Constraints

- No backend, API, data-model, authentication, or document-ingestion changes.
- Never hard-code document totals, study progress, or AI answers.
- Dashboard actions transfer drafts to Chat but never submit a query automatically.
- Keep accessible labels, visible focus states, and 44px touch targets.
- Do not stage `.superpowers/`; it is ignored. Git metadata is read-only in this sandbox.

---

### Task 1: Establish dashboard behavior with failing tests

**Files:**
- Modify: `frontend/tests/App.test.tsx`

**Interfaces:**
- Consumes: mocked `apiService` methods.
- Produces: tests for hero visibility, real ready-document count, and dashboard-to-chat draft transfer.

- [ ] **Step 1: Extend the API mock and imports**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiService } from '../src/services/api';

queryRag: vi.fn(),
```

- [ ] **Step 2: Write the failing dashboard tests**

```tsx
it('shows the Aurora focus hero and the ready document count', async () => {
  vi.mocked(apiService.getDocuments).mockResolvedValueOnce({
    data: [{ id: 'ready', filename: 'de-toan.pdf', status: 'ready' }],
  });
  render(<App />);
  expect(await screen.findByRole('heading', { name: /Hôm nay mình học gì/i })).toBeInTheDocument();
  expect(screen.getByText(/1 tài liệu sẵn sàng/i)).toBeInTheDocument();
});

it('moves a dashboard question to chat without querying', async () => {
  vi.mocked(apiService.getDocuments).mockResolvedValueOnce({
    data: [{ id: 'ready', filename: 'de-toan.pdf', status: 'ready' }],
  });
  render(<App />);
  const input = await screen.findByRole('textbox', { name: /Câu hỏi nhanh/i });
  fireEvent.change(input, { target: { value: 'Tóm tắt chương tích phân' } });
  fireEvent.submit(input.closest('form')!);
  expect(await screen.findByRole('heading', { name: /Hỏi bài cùng StudyRAG/i })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: /Câu hỏi cho StudyRAG/i })).toHaveValue('Tóm tắt chương tích phân');
  expect(apiService.queryRag).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Verify the tests fail**

Run: `cd frontend && npm test -- --run tests/App.test.tsx`

Expected: FAIL because the focus hero and `Câu hỏi nhanh` field do not exist.

### Task 2: Create the Aurora focus-hero dashboard

**Files:**
- Create: `frontend/src/components/dashboard/Dashboard.tsx`
- Create: `frontend/src/styles/dashboard.css`
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/styles/index.css`

**Interfaces:**
- Consumes: `connectionState`, `errorMessage`, `documents`, `onRetry`, `onOpenChat(question)`, and `onOpenLibrary`.
- Produces: `Dashboard`, a form textbox labelled `Câu hỏi nhanh`, and a document count derived from `status === 'ready'`.

- [ ] **Step 1: Add the exact dashboard data contract**

```tsx
export interface DashboardDocument {
  id: string;
  filename?: string;
  title?: string;
  status?: string;
}

interface DashboardProps {
  connectionState: ConnectionState;
  errorMessage: string;
  documents: DashboardDocument[];
  onRetry: () => void;
  onOpenChat: (question: string) => void;
  onOpenLibrary: () => void;
}
```

- [ ] **Step 2: Implement the semantic hero and only real support data**

```tsx
const readyDocumentCount = documents.filter((document) => document.status === 'ready').length;
const canAsk = connectionState === 'connected' && readyDocumentCount > 0;

<section className="dashboard" aria-labelledby="dashboard-title">
  <div className="dashboard__aurora" aria-hidden="true" />
  <p className="dashboard__eyebrow">STUDYRAG · TRỢ LÝ CÓ NGUỒN DẪN</p>
  <h2 id="dashboard-title">Hôm nay mình học gì?</h2>
  <p className="dashboard__lede">Hỏi từ chính tài liệu của bạn, rồi kiểm tra lại từng nguồn.</p>
  <form className="dashboard-prompt" onSubmit={handleSubmit}>
    <label className="sr-only" htmlFor="dashboard-question">Câu hỏi nhanh</label>
    <input id="dashboard-question" value={question} onChange={(event) => setQuestion(event.target.value)} />
    <button type="submit" disabled={!canAsk || !question.trim()}>Hỏi AI <ArrowUpRight size={18} /></button>
  </form>
</section>
```

- [ ] **Step 3: Implement all dashboard states**

```tsx
{connectionState === 'checking' && <p className="dashboard-status">Đang kiểm tra StudyRAG…</p>}
{connectionState === 'error' && <div className="dashboard-status dashboard-status--error" role="alert"><span>{errorMessage || 'Không kết nối được máy chủ.'}</span><button type="button" onClick={onRetry}>Thử lại</button></div>}
{connectionState === 'connected' && readyDocumentCount === 0 && <button className="dashboard-empty-action" type="button" onClick={onOpenLibrary}>Tải tài liệu để bắt đầu</button>}
```

- [ ] **Step 4: Add scoped Aurora CSS and responsive layout**

```css
.dashboard { position: relative; isolation: isolate; max-width: 1120px; margin: 0 auto; padding: clamp(3rem, 8vw, 7rem) 0 3rem; }
.dashboard__aurora { position: absolute; inset: 0; z-index: -1; pointer-events: none; filter: blur(8px); background: radial-gradient(circle at 78% 4%, rgba(122, 104, 255, .32), transparent 31%), radial-gradient(circle at 4% 58%, rgba(89, 224, 195, .14), transparent 33%); }
.dashboard-prompt { display: grid; grid-template-columns: 1fr auto; gap: .65rem; max-width: 760px; padding: .55rem; border: 1px solid rgba(203, 205, 255, .18); border-radius: 1rem; background: rgba(10, 11, 30, .66); }
@media (max-width: 680px) { .dashboard-prompt, .dashboard-support { grid-template-columns: 1fr; } }
```

- [ ] **Step 5: Replace only the dashboard branch in `App`**

```tsx
{activeTab === 'dashboard' && <Dashboard connectionState={connectionState} errorMessage={errorMessage} documents={documents} onRetry={checkConnection} onOpenLibrary={() => setActiveTab('library')} onOpenChat={(question) => { setChatDraft(question); setActiveTab('chat'); }} />}
```

- [ ] **Step 6: Verify dashboard tests pass**

Run: `cd frontend && npm test -- --run tests/App.test.tsx`

Expected: PASS.

### Task 3: Transfer drafts into the existing chat composer

**Files:**
- Modify: `frontend/src/components/chat/ChatPanel.tsx`
- Modify: `frontend/tests/ChatPanel.test.tsx`
- Modify: `frontend/src/app/App.tsx`

**Interfaces:**
- Consumes: `draft?: string`.
- Produces: a composer populated by a non-empty dashboard draft, with no automatic `queryRag` request.

- [ ] **Step 1: Write the failing ChatPanel test**

```tsx
it('copies a dashboard draft into the composer without sending it', () => {
  render(<ChatPanel documents={[{ id: 'ready', status: 'ready' }]} onOpenLibrary={vi.fn()} draft="Giải câu 1" />);
  expect(screen.getByRole('textbox', { name: /Câu hỏi cho StudyRAG/i })).toHaveValue('Giải câu 1');
});
```

- [ ] **Step 2: Verify it fails**

Run: `cd frontend && npm test -- --run tests/ChatPanel.test.tsx`

Expected: FAIL because `draft` is absent from `ChatPanelProps`.

- [ ] **Step 3: Add the prop and effect**

```tsx
interface ChatPanelProps { documents: ChatDocument[]; onOpenLibrary: () => void; draft?: string; }

export const ChatPanel: React.FC<ChatPanelProps> = ({ documents, onOpenLibrary, draft = '' }) => {
  const [input, setInput] = useState('');
  useEffect(() => { if (draft.trim()) setInput(draft); }, [draft]);
```

- [ ] **Step 4: Pass the draft from `App` and test both files**

```tsx
const [chatDraft, setChatDraft] = useState('');
<ChatPanel documents={documents} draft={chatDraft} onOpenLibrary={() => setActiveTab('library')} />
```

Run: `cd frontend && npm test -- --run tests/ChatPanel.test.tsx tests/App.test.tsx`

Expected: PASS.

### Task 4: Refine the shared shell and verify the demo

**Files:**
- Modify: `frontend/src/styles/header.css`
- Modify: `frontend/src/styles/index.css`
- Modify: `frontend/src/app/App.tsx`

**Interfaces:**
- Consumes: unchanged `HeaderProps`.
- Produces: compact responsive header with existing navigation and refresh controls unchanged.

- [ ] **Step 1: Delete dashboard-only demo state and imports**

```tsx
// Delete DemoCitation, DemoQuery, demoQueries, selectedSubject,
// activeDemoIndex, roadmapMilestones, StatusCard, and their dashboard-only icons.
// Keep polling, Library, Chat, History, Settings, and footer behavior unchanged.
```

- [ ] **Step 2: Add the compact Aurora header rules**

```css
.app-header { position: sticky; top: 0; z-index: 20; border-bottom: 1px solid rgba(218, 219, 255, .1); background: rgba(9, 10, 26, .72); backdrop-filter: blur(18px); }
.app-navigation__item.is-active { color: #fff; background: rgba(132, 121, 255, .16); box-shadow: inset 0 -1px 0 rgba(185, 180, 255, .88); }
@media (max-width: 760px) { .app-navigation { overflow-x: auto; } }
```

- [ ] **Step 3: Run full verification and the live demo**

Run: `cd frontend && npm test -- --run && npm run build && npm run dev`

Expected: tests pass, Vite builds, then serves the redesigned dashboard at `http://localhost:5173`; manually verify desktop/mobile, empty-library CTA, retry state, and draft transfer.

- [ ] **Step 4: Commit outside this sandbox if desired**

```bash
git add .gitignore docs/superpowers frontend/src frontend/tests
git commit -m "feat: redesign aurora dashboard"
```
