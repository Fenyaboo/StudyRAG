import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '../src/components/common/AppShell';

describe('AppShell', () => {
  it('offers desktop sidebar navigation and mobile bottom navigation without duplicate landmarks', () => {
    render(
      <AppShell activeTab="dashboard" onNavigate={vi.fn()}>
        <p>Nội dung học tập</p>
      </AppShell>,
    );

    const desktopNavigation = screen.getByRole('navigation', { name: /điều hướng chính/i });
    expect(desktopNavigation).toBeInTheDocument();
    expect(within(desktopNavigation).getByRole('button', { name: /thư viện/i })).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: /điều hướng chính/i })).toHaveLength(1);
  });

  it('uses the mobile profile action for navigation', () => {
    const onNavigate = vi.fn();

    render(
      <AppShell activeTab="dashboard" onNavigate={onNavigate}>
        <p>Nội dung học tập</p>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole('button', { name: /hồ sơ/i }));

    expect(onNavigate).toHaveBeenCalledWith('settings');
  });
});
