import type { PropsWithChildren } from 'react';
import { BookOpen, BrainCircuit, LayoutDashboard, Settings, UserRound } from 'lucide-react';
import { Header } from './Header';
import type { AppTab } from '../../auth/access';
import '../../styles/shell.css';

interface AppShellProps extends PropsWithChildren {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  onSignedOut?: () => void;
}

const desktopItems = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'library', label: 'Thư viện', icon: BookOpen },
  { id: 'chat', label: 'Hỏi AI', icon: BrainCircuit },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
];

const mobileItems = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'library', label: 'Thư viện', icon: BookOpen },
  { id: 'chat', label: 'Hỏi AI', icon: BrainCircuit },
  { id: 'settings', label: 'Hồ sơ', icon: UserRound },
];

interface NavigationItemsProps {
  activeTab: AppTab;
  items: typeof desktopItems;
  onNavigate: (tab: AppTab) => void;
}

const NavigationItems = ({ activeTab, items, onNavigate }: NavigationItemsProps) => (
  <>
    {items.map(({ id, label, icon: Icon }) => {
      const isActive = activeTab === id;

      return (
        <button
          key={id}
          type="button"
          className={`study-navigation__item${isActive ? ' is-active' : ''}`}
          onClick={() => onNavigate(id as AppTab)}
          aria-current={isActive ? 'page' : undefined}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{label}</span>
        </button>
      );
    })}
  </>
);

export const AppShell = ({ activeTab, onNavigate, onSignedOut, children }: AppShellProps) => (
  <div className="study-shell">
    <Header activeTab={activeTab} onNavigate={onNavigate} onSignedOut={onSignedOut} />
    <div className="study-shell__body">
      <aside className="app-sidebar">
        <nav className="study-navigation" aria-label="Điều hướng chính">
          <NavigationItems activeTab={activeTab} items={desktopItems} onNavigate={onNavigate} />
        </nav>
      </aside>
      <main className={`study-main${activeTab === 'chat' ? ' study-main--chat' : ''}`}>
        {children}
      </main>
    </div>
    <nav className="mobile-tabbar" aria-label="Điều hướng di động">
      <NavigationItems activeTab={activeTab} items={mobileItems} onNavigate={onNavigate} />
    </nav>
  </div>
);
