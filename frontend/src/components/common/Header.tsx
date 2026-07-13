import React from 'react';
import { Activity, Cpu, Database, MessageSquare, RefreshCw, Terminal } from 'lucide-react';
import { ConnectionState } from '../../types';
import '../../styles/header.css';

interface HeaderProps {
  connectionState: ConnectionState;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connectionState,
  activeTab,
  setActiveTab,
  onRefresh
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: <Activity size={16} /> },
    { id: 'library', label: 'Tài liệu', icon: <Database size={16} /> },
    { id: 'chat', label: 'Hỏi AI', icon: <MessageSquare size={16} /> },
    { id: 'history', label: 'Lịch sử', icon: <Terminal size={16} /> },
    { id: 'settings', label: 'Cài đặt', icon: <Cpu size={16} /> },
  ];

  const statusLabel = connectionState === 'connected'
    ? 'Đã kết nối'
    : connectionState === 'error'
      ? 'Mất kết nối'
      : 'Đang kiểm tra';

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <a
          className="app-brand"
          href="#dashboard"
          onClick={(event) => {
            event.preventDefault();
            setActiveTab('dashboard');
          }}
        >
          <span className="app-brand__mark" aria-hidden="true">
            <Cpu size={21} />
          </span>
          <span className="app-brand__copy">
            <span className="app-brand__title-row">
              <h1>StudyRAG</h1>
              <span className="app-brand__version">BETA</span>
            </span>
            <span className="app-brand__subtitle">Trợ lý ôn thi có nguồn dẫn</span>
          </span>
        </a>

        <nav className="app-navigation" aria-label="Điều hướng chính">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;

            return (
              <button
                className={`app-navigation__item${isActive ? ' is-active' : ''}`}
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="app-header__actions">
          <div className={`connection-status connection-status--${connectionState}`} aria-live="polite">
            <span className="connection-status__dot" aria-hidden="true" />
            <span>{statusLabel}</span>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onRefresh}
            title="Làm mới trạng thái API"
            aria-label="Làm mới trạng thái API"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
