import React from 'react';
import { Cpu, RefreshCw, Activity, Terminal, Database, MessageSquare } from 'lucide-react';
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
    { id: 'dashboard', label: 'Dashboard', icon: <Activity size={15} /> },
    { id: 'library', label: 'Kho Tài Liệu (M1)', icon: <Database size={15} /> },
    { id: 'chat', label: 'Hỏi Đáp AI (M2-M3)', icon: <MessageSquare size={15} /> },
    { id: 'history', label: 'Lịch Sử', icon: <Terminal size={15} /> },
    { id: 'settings', label: 'Cài Đặt', icon: <Cpu size={15} /> },
  ];

  return (
    <header style={{
      borderBottom: '1px solid var(--color-border)',
      backgroundColor: 'rgba(9, 13, 22, 0.8)',
      backdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      padding: '0.75rem 2rem',
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
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--color-primary), #4f46e5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
          }}>
            <Cpu size={22} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, letterSpacing: '-0.03em', color: '#fff' }}>
                StudyRAG
              </h1>
              <span style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                background: 'rgba(99, 102, 241, 0.18)',
                color: 'var(--color-primary-light)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                STUDIO V2
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
              AI Knowledge & Exam Assistant cho Lớp 12
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', background: 'rgba(255, 255, 255, 0.03)', padding: '0.25rem', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  padding: '0.45rem 0.95rem',
                  borderRadius: '8px',
                  fontSize: '0.86rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#fff' : 'var(--color-muted)',
                  background: isActive ? 'var(--color-primary)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 2px 10px rgba(99, 102, 241, 0.4)' : 'none',
                }}
              >
                {item.icon}
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
            gap: '0.5rem',
            padding: '0.35rem 0.8rem',
            borderRadius: '20px',
            background: connectionState === 'connected'
              ? 'rgba(16, 185, 129, 0.1)'
              : connectionState === 'error'
              ? 'rgba(239, 68, 68, 0.1)'
              : 'rgba(245, 158, 11, 0.1)',
            border: `1px solid ${
              connectionState === 'connected'
                ? 'rgba(16, 185, 129, 0.3)'
                : connectionState === 'error'
                ? 'rgba(239, 68, 68, 0.3)'
                : 'rgba(245, 158, 11, 0.3)'
            }`
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: connectionState === 'connected'
                ? 'var(--color-success)'
                : connectionState === 'error'
                ? 'var(--color-danger)'
                : 'var(--color-warning)'
            }} />
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: connectionState === 'connected'
                ? 'var(--color-success)'
                : connectionState === 'error'
                ? 'var(--color-danger)'
                : 'var(--color-warning)'
            }}>
              {connectionState === 'connected' && 'Backend Connected'}
              {connectionState === 'checking' && 'Connecting...'}
              {connectionState === 'error' && 'Disconnected'}
            </span>
          </div>

          <button
            onClick={onRefresh}
            title="Làm mới trạng thái API"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};
