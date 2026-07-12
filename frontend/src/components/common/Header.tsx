import React from 'react';
import { Sparkles, Radio, RefreshCw } from 'lucide-react';
import { ConnectionState } from '../../types';

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
    { id: 'dashboard', label: 'Tổng quan' },
    { id: 'library', label: 'Thư viện (M1)' },
    { id: 'chat', label: 'Hỏi đáp (M2-M3)' },
    { id: 'history', label: 'Lịch sử' },
    { id: 'settings', label: 'Cài đặt' },
  ];

  return (
    <header style={{
      borderBottom: '1px solid rgba(141, 122, 255, 0.18)',
      backgroundColor: 'rgba(11, 16, 34, 0.8)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '0.8rem 2rem'
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(141, 122, 255, 0.2), rgba(247, 197, 107, 0.2))',
            border: '1px solid var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(141, 122, 255, 0.3)'
          }}>
            <Sparkles size={22} color="var(--color-accent)" />
          </div>
          <div>
            <h1 className="glow-text" style={{ fontSize: '1.4rem', lineHeight: 1.2 }}>
              StudyRAG V2
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'block' }}>
              Thư viện thiên văn — Trợ lý ôn thi lớp 12
            </span>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: '0.5rem' }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.9rem',
                fontWeight: activeTab === item.id ? 600 : 400,
                color: activeTab === item.id ? 'var(--color-text)' : 'var(--color-muted)',
                backgroundColor: activeTab === item.id ? 'var(--color-surface-raised)' : 'transparent',
                border: activeTab === item.id ? '1px solid rgba(141, 122, 255, 0.3)' : '1px solid transparent',
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '20px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '0.8rem'
          }}>
            <Radio
              size={14}
              color={
                connectionState === 'online'
                  ? 'var(--color-success)'
                  : connectionState === 'offline'
                  ? 'var(--color-danger)'
                  : 'var(--color-accent)'
              }
              style={{
                animation: connectionState === 'checking' ? 'pulse 1.5s infinite' : 'none'
              }}
            />
            <span style={{
              color:
                connectionState === 'online'
                  ? 'var(--color-success)'
                  : connectionState === 'offline'
                  ? 'var(--color-danger)'
                  : 'var(--color-accent)',
              fontWeight: 500
            }}>
              {connectionState === 'online' && 'Backend Online'}
              {connectionState === 'offline' && 'Backend Offline'}
              {connectionState === 'checking' && 'Checking API...'}
            </span>
          </div>

          <button
            onClick={onRefresh}
            title="Kiểm tra lại kết nối API"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid rgba(141, 122, 255, 0.2)',
              borderRadius: '8px',
              padding: '0.45rem',
              color: 'var(--color-text)',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
