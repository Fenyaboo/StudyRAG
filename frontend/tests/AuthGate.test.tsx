import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGate } from '../src/auth/AuthGate';

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock('../src/auth/AuthProvider', () => ({ useAuth: useAuthMock }));

const emailUser = {
  email: 'student@example.com',
  app_metadata: { provider: 'email' },
  identities: [{ provider: 'email' }],
  email_confirmed_at: null,
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

describe('AuthGate', () => {
  beforeEach(() => {
    installLocalStorage();
    window.localStorage.clear();
    window.location.hash = '';
  });

  it('keeps an unconfirmed email account outside the private workspace', () => {
    useAuthMock.mockReturnValue({ loading: false, user: emailUser });

    render(<AuthGate><div>private workspace</div></AuthGate>);

    expect(screen.queryByText('private workspace')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /chào mừng trở lại/i })).toBeInTheDocument();
  });

  it('allows a Google identity into the private workspace', () => {
    useAuthMock.mockReturnValue({
      loading: false,
      user: { ...emailUser, app_metadata: { provider: 'google' }, identities: [{ provider: 'google' }] },
    });

    render(<AuthGate><div>private workspace</div></AuthGate>);

    expect(screen.getByText('private workspace')).toBeInTheDocument();
  });

  it('stores a requested private tab before showing sign-in', async () => {
    window.location.hash = '#library';
    useAuthMock.mockReturnValue({ loading: false, user: null });

    render(<AuthGate><div>private workspace</div></AuthGate>);

    await waitFor(() => {
      expect(window.localStorage.getItem('studyrag:intended-tab')).toBe('library');
    });
  });
});
