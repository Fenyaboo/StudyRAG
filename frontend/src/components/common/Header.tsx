import { BookOpen } from 'lucide-react';
import { AccountMenu } from './AccountMenu';
import type { AppTab } from '../../auth/access';
import '../../styles/header.css';

interface HeaderProps {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  onSignedOut?: () => void;
}

const pageTitles: Record<string, string> = {
  dashboard: 'Tổng quan',
  library: 'Thư viện',
  chat: 'Hỏi AI',
  settings: 'Hồ sơ',
};

export const Header = ({ activeTab, onNavigate, onSignedOut }: HeaderProps) => (
  <header className="study-header">
    <a
      className="study-brand"
      href="#dashboard"
      onClick={(event) => {
        event.preventDefault();
        onNavigate('dashboard');
      }}
    >
      <span className="study-brand__mark" aria-hidden="true"><BookOpen size={20} /></span>
      <span>StudyRAG</span>
    </a>
    <p className="study-header__context">{pageTitles[activeTab] || 'Không gian học tập'}</p>
    <AccountMenu onSignedOut={onSignedOut} />
  </header>
);
