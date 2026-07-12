import React from 'react';
import { Sparkles, Radio, RefreshCw, Compass } from 'lucide-react';
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
    { id: 'dashboard', label: '🔭 Đài quan sát' },
    { id: 'library', label: '📚 Thư viện PDF (M1)' },
    { id: 'chat', label: '💬 Hỏi đáp AI (M2-M3)' },
    { id: 'history', label: '⌛ Lịch sử' },
    { id: 'settings', label: '⚙️ Cài đặt' },
  ];

  return (
    <header style={{
      borderBottom: '1px solid rgba(141, 122, 255, 0.25)',
      backgroundColor: 'rgba(6, 8, 20, 0.75)',
      backdropFilter: 'blur(24px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      padding: '0.85rem 2rem',
      boxShadow: '0 10px 35px rgba(0, 0, 0, 0.6)'
    }}>
      <div style={{
        maxWidth: '1360px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Brand */}
        <div 
          onClick={() => setActiveTab('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', cursor: 'pointer' }}
        >
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(141, 122, 255, 0.3), rgba(247, 197, 107, 0.25))',
            border: '1px solid rgba(141, 122, 255, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(141, 122, 255, 0.45)',
            animation: 'floatSmooth 4s ease-in-out infinite'
          }}>
            <Sparkles size={24} color="var(--color-accent)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 className="glow-text" style={{ fontSize: '1.45rem', lineHeight: 1.2, margin: 0 }}>
                StudyRAG V2
              </h1>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '6px',
                background: 'linear-gradient(90deg, var(--color-primary), #c084fc)',
                color: '#fff',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                PRO
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Compass size={12} color="var(--color-cyan)" /> Thư viện Thiên văn — Trợ lý Ôn thi Lớp 12
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  padding: '0.55rem 1.15rem',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#fff' : 'var(--color-muted)',
                  background: isActive 
                    ? 'linear-gradient(135deg, rgba(141, 122, 255, 0.35), rgba(56, 189, 248, 0.2))' 
                    : 'transparent',
                  border: isActive 
                    ? '1px solid rgba(141, 122, 255, 0.6)' 
                    : '1px solid transparent',
                  boxShadow: isActive ? '0 0 18px rgba(141, 122, 255, 0.3)' : 'none',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Live Status & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
            padding: '0.45rem 0.95rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(18, 24, 48, 0.85)',
            border: connectionState === 'online'
              ? '1px solid rgba(52, 211, 153, 0.4)'
              : connectionState === 'offline'
              ? '1px solid rgba(251, 113, 133, 0.4)'
              : '1px solid rgba(247, 197, 107, 0.4)',
            boxShadow: connectionState === 'online'
              ? '0 0 15px rgba(52, 211, 153, 0.2)'
              : 'none',
            fontSize: '0.82rem'
          }}>
            <Radio
              size={15}
              color={
                connectionState === 'online'
                  ? 'var(--color-success)'
                  : connectionState === 'offline'
                  ? 'var(--color-danger)'
                  : 'var(--color-accent)'
              }
              style={{
                animation: connectionState === 'checking' ? 'pulse 1.2s infinite' : 'none'
              }}
            />
            <span style={{
              color:
                connectionState === 'online'
                  ? 'var(--color-success)'
                  : connectionState === 'offline'
                  ? 'var(--color-danger)'
                  : 'var(--color-accent)',
              fontWeight: 600
            }}>
              {connectionState === 'online' && 'API Live Monitoring'}
              {connectionState === 'offline' && 'Backend Standby'}
              {connectionState === 'checking' && 'Đang dò sóng API...'}
            </span>
          </div>

          <button
            onClick={onRefresh}
            title="Dò lại sóng kết nối Backend"
            style={{
              background: 'rgba(141, 122, 255, 0.15)',
              border: '1px solid rgba(141, 122, 255, 0.35)',
              borderRadius: '12px',
              padding: '0.55rem',
              color: 'var(--color-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          >
            <RefreshCw size={17} color="var(--color-primary-light)" />
          </button>
        </div>
      </div>
    </header>
  );
};
