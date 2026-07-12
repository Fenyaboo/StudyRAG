import React from 'react';
import { ShieldCheck, Server, Database, Cpu, Clock, AlertTriangle, CheckCircle2, Rocket } from 'lucide-react';
import { HealthStatus, ReadyStatus, ConnectionState } from '../../types';

interface StatusCardProps {
  health: HealthStatus | null;
  ready: ReadyStatus | null;
  latencyMs: number;
  connectionState: ConnectionState;
  errorMessage?: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  health,
  ready,
  latencyMs,
  connectionState,
  errorMessage
}) => {
  return (
    <div className="glass-card" style={{ maxWidth: '900px', margin: '2rem auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Server size={24} color="var(--color-primary)" />
          <h2 style={{ fontSize: '1.35rem' }}>Trạng thái Backend API (Milestone 0)</h2>
        </div>
        
        {connectionState === 'online' && (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.3rem 0.8rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(116, 212, 173, 0.15)',
            color: 'var(--color-success)',
            fontSize: '0.85rem',
            fontWeight: 600
          }}>
            <CheckCircle2 size={16} /> Online ({latencyMs} ms)
          </span>
        )}

        {connectionState === 'offline' && (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.3rem 0.8rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(239, 124, 142, 0.15)',
            color: 'var(--color-danger)',
            fontSize: '0.85rem',
            fontWeight: 600
          }}>
            <AlertTriangle size={16} /> Disconnected
          </span>
        )}
      </div>

      {connectionState === 'checking' && (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          Đang kiểm tra kết nối tới Backend (`/api/v1/health`)...
        </div>
      )}

      {connectionState === 'offline' && (
        <div style={{
          padding: '1.2rem',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'rgba(239, 124, 142, 0.08)',
          border: '1px solid rgba(239, 124, 142, 0.3)',
          marginBottom: '1.5rem',
          fontSize: '0.9rem'
        }}>
          <p style={{ fontWeight: 600, color: 'var(--color-danger)', marginBottom: '0.5rem' }}>
            Không thể kết nối đến Backend (`{errorMessage || 'Fetch failed'}`)
          </p>
          <p style={{ color: 'var(--color-text)', marginBottom: '0.5rem' }}>
            <strong>Hướng dẫn khi Test trên Vercel / GitHub:</strong> Nếu bạn đang xem giao diện này trên Vercel (static deployment), Backend FastAPI (Python) chưa chạy trên cùng domain này. Bạn có thể cấu hình biến môi trường `VITE_API_BASE_URL` trỏ về server App Runner hoặc chạy local với lệnh:
          </p>
          <code style={{
            display: 'block',
            padding: '0.6rem',
            backgroundColor: 'var(--color-bg)',
            borderRadius: '6px',
            color: 'var(--color-accent)',
            fontFamily: 'monospace'
          }}>
            make dev # Chạy song song cả Backend (8000) và Frontend (5173) qua Docker
          </code>
        </div>
      )}

      {connectionState === 'online' && health && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-muted)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              <ShieldCheck size={16} color="var(--color-primary)" /> Phiên bản API
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>v{health.version}</div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'var(--color-surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-muted)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              <Rocket size={16} color="var(--color-accent)" /> Môi trường (Env)
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, textTransform: 'capitalize' }}>{health.environment}</div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'var(--color-surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-muted)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              <Database size={16} color="var(--color-success)" /> Database & Storage
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {ready?.database === 'sqlite_ready' ? 'SQLite Ready' : 'Processing'}
            </div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'var(--color-surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-muted)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              <Cpu size={16} color="#c084fc" /> Embedding Provider
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ready?.embedding_provider || 'Sentence Transformers'}
            </div>
          </div>
        </div>
      )}

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--color-muted)', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span>Đã xác thực theo thỏa thuận API contract V1 (`STUDYRAG_PROJECT.md`)</span>
        {health?.timestamp && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Clock size={14} /> Cập nhật: {new Date(health.timestamp).toLocaleTimeString('vi-VN')}
          </span>
        )}
      </div>
    </div>
  );
};
