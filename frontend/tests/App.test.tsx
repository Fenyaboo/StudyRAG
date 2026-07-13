import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { AuthGate } from '../src/auth/AuthGate';
import { useAuth } from '../src/auth/AuthProvider';

const { fetchMock, getSessionMock, localSignOutMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  getSessionMock: vi.fn(),
  localSignOutMock: vi.fn(),
}));

vi.mock('../src/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      signOut: localSignOutMock,
    },
  },
  isSupabaseConfigured: true,
  supabaseSetupMessage: '',
}));

vi.mock('../src/auth/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

const authenticatedUser = {
  email: 'hoai.phong@example.com',
  user_metadata: {},
  email_confirmed_at: '2026-07-13T00:00:00Z',
};

const storage = new Map<string, string>();

const installLocalStorage = () => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
  });
};

let authValue: { user: typeof authenticatedUser | null; signOut: () => Promise<{ error: null }> };

const AuthGateHarness = () => {
  const [user, setUser] = useState<typeof authenticatedUser | null>(authenticatedUser);
  const signOut = async () => {
    setUser(null);
    return { error: null };
  };

  authValue = { user, signOut };
  return <AuthGate><App /></AuthGate>;
};

const healthPayload = {
  status: 'ok',
  version: '2.0.0',
  environment: 'development',
  timestamp: '2026-07-12T16:30:00Z',
};

const jsonResponse = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const mockApiResponses = (documentResponses: Response[]) => {
  fetchMock.mockImplementation(async (request: RequestInfo | URL) => {
    const url = String(request);

    if (url.endsWith('/health')) return jsonResponse(healthPayload);
    if (url.endsWith('/documents')) {
      const response = documentResponses.shift();
      if (response) return response;
    }

    throw new Error(`Unexpected request: ${url}`);
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  installLocalStorage();
  window.localStorage.clear();
  window.location.hash = '';
  authValue = {
    user: authenticatedUser,
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
  vi.mocked(useAuth).mockImplementation(() => authValue as never);
  getSessionMock.mockResolvedValue({ data: { session: { access_token: 'test-access-token' } } });
  localSignOutMock.mockResolvedValue({ error: null });
  mockApiResponses([jsonResponse([])]);
  vi.stubGlobal('fetch', fetchMock);
});

describe('App component', () => {
  it('restores a private Library destination after a valid login', async () => {
    window.localStorage.setItem('studyrag:intended-tab', 'library');

    render(<App />);

    expect(await screen.findByRole('heading', { name: /tài liệu cho phiên học/i })).toBeInTheDocument();
    expect(window.localStorage.getItem('studyrag:intended-tab')).toBeNull();
  });

  it('shows the clean study dashboard with the real ready document count', async () => {
    mockApiResponses([jsonResponse([
      { id: 'ready-document', filename: 'de-toan.pdf', status: 'ready' },
      { id: 'processing-document', filename: 'de-ly.pdf', status: 'processing' },
    ])]);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /Hôm nay mình học gì/i })).toBeInTheDocument();
    expect(await screen.findByText(/1 tài liệu sẵn sàng/i)).toBeInTheDocument();
  });

  it('moves a dashboard question to chat without querying the API', async () => {
    mockApiResponses([jsonResponse([{ id: 'ready-document', filename: 'de-toan.pdf', status: 'ready' }])]);

    render(<App />);

    await screen.findByText(/1 tài liệu sẵn sàng/i);
    const input = await screen.findByRole('textbox', { name: /Câu hỏi nhanh/i });
    fireEvent.change(input, { target: { value: 'Tóm tắt chương tích phân' } });
    fireEvent.click(within(input.closest('form')!).getByRole('button', { name: /Hỏi AI/i }));

    expect(await screen.findByRole('heading', { name: /Hỏi bài cùng StudyRAG/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Câu hỏi cho StudyRAG/i })).toHaveValue('Tóm tắt chương tích phân');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('clears private dashboard state after account sign-out', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(useAuth).mockReturnValue({
      user: authenticatedUser,
      signOut,
    } as never);
    mockApiResponses([jsonResponse([{ id: 'ready-document', filename: 'de-toan.pdf', status: 'ready' }])]);

    render(<App />);

    expect(await screen.findByText(/1 tài liệu sẵn sàng/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hoai.phong@example.com/i }));
    fireEvent.click(screen.getByRole('button', { name: /đăng xuất/i }));

    expect(signOut).toHaveBeenCalledOnce();
    expect(await screen.findByText(/0 tài liệu sẵn sàng/i)).toBeInTheDocument();
  });

  it('clears private document content and returns to sign-in after getDocuments receives HTTP 401', async () => {
    vi.useFakeTimers();
    mockApiResponses([
      jsonResponse([{ id: 'private-pdf', filename: 'private.pdf', status: 'ready' }]),
      new Response(null, { status: 401 }),
    ]);

    try {
      render(<AuthGateHarness />);

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText(/1 tài liệu sẵn sàng/i)).toBeInTheDocument();
      fireEvent.click(screen.getAllByRole('button', { name: 'Thư viện' })[0]);
      expect(screen.getAllByText('private.pdf')).not.toHaveLength(0);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      expect(screen.getByRole('heading', { name: /chào mừng trở lại/i })).toBeInTheDocument();
      expect(screen.queryByText('private.pdf')).not.toBeInTheDocument();
      expect(window.localStorage.getItem('studyrag:intended-tab')).toBe('library');
      expect(fetchMock.mock.calls.filter(([request]) => String(request).endsWith('/documents'))).toHaveLength(2);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/documents$/),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-access-token' }),
        }),
      );
      expect(localSignOutMock).toHaveBeenCalledWith({ scope: 'local' });
    } finally {
      vi.useRealTimers();
    }
  });
});
