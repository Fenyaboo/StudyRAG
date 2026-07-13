import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthGate } from '../src/auth/AuthGate';

describe('AuthGate', () => {
  it('renders the public sign-in screen instead of private navigation when signed out', () => {
    render(
      <AuthGate>
        <div>private workspace</div>
      </AuthGate>,
    );

    expect(screen.getByRole('heading', { name: /chào mừng trở lại/i })).toBeInTheDocument();
    expect(screen.queryByText('private workspace')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tiếp tục với google/i })).toBeInTheDocument();
  });
});
