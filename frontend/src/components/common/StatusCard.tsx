import React from 'react';
import { ShieldCheck, Server, Database, Cpu, Clock, AlertTriangle, CheckCircle2, Rocket, Zap, Activity } from 'lucide-react';
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
    <div className="glass-card" style={{ 
      maxWidth: '1000px', 
      margin: '2.5rem auto',
      background: 'linear-gradient(135deg, rgba(18, 24, 48, 0.75), rgba(28, 38, 76, 0.55))',
      border: '1px solid rgba(141, 122, 255, 0.35)',
      boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(141, 122, 255, 0.15)'
    }}>
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            padding: '0.65rem',
            borderRadius: '14px',
            backgroundColor: 'rgba(141, 122, 255, 0.2)',
            border: '1px solid rgba(141, 122, 255, 0.5)',
            display: 'flex'
          }}>
            <Server size={24} color="var(--color-primary-light)" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Trung tâm Điều khiển API <span style={{ fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: 500 }}>(Milestone 0)</span>
            </h2>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>
              Giám sát kết nối theo thời gian thực tới Backend FastAPI & Vector Storage
            </span>
          </div>
        </div>
        
        {connectionState === 'online' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 1rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(52, 211, 153, 0.15)',
              border: '1px solid rgba(52, 211, 153, 0.4)',
              color: 'var(--color-success)',
              fontSize: '0.88rem',
              fontWeight: 700,
              boxShadow: '0 0 20px rgba(52, 211, 153, 0.25)'
            }}>
              <CheckCircle2 size={18} /> Online & Sẵn sàng
            </span>
            <span style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: 'var(--color-cyan)',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}>
              <Activity size={15} /> {latencyMs} ms
            </span>
          </div>
        )}

        {connectionState === 'offline' && (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.45rem 1rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(251, 113, 133, 0.18)',
            border: '1px solid rgba(251, 113, 133, 0.45)',
            color: 'var(--color-danger)',
            fontSize: '0.88rem',
            fontWeight: 700,
            boxShadow: '0 0 20px rgba(251, 113, 133, 0.3)'
          }}>
            <AlertTriangle size={18} /> Chế độ Độc lập (Static View)
          </span>
        )}
      </div>

      {connectionState === 'checking' && (
        <div style={{ 
          padding: '3rem 2rem', 
          textAlign: 'center', 
          color: 'var(--color-muted)',
          background: 'rgba(11, 16, 34, 0.5)',
          borderRadius: 'var(--radius-sm)',
          border: '1px dashed rgba(141, 122, 255, 0.3)'
        }}>
          <Activity size={32} color="var(--color-primary)" style={{ animation: 'pulse 1.2s infinite', margin: '0 auto 1rem auto' }} />
          <p style={{ fontSize: '1.05rem', fontWeight: 500 }}>Đang thiết lập kết nối radar tới trạm dữ liệu Backend (`/api/v1/health`)...</p>
        </div>
      )}

      {connectionState === 'offline' && (
        <div style={{
          padding: '1.5rem',
          borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, rgba(251, 113, 133, 0.12), rgba(20, 27, 54, 0.8))',
          border: '1px solid rgba(251, 113, 133, 0.35)',
          marginBottom: '1.75rem',
          fontSize: '0.92rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
            <AlertTriangle size={20} color="var(--color-danger)" />
            <h4 style={{ color: 'var(--color-danger)', fontSize: '1.05rem', margin: 0 }}>
              Giao diện đang xem ở chế độ tĩnh ({errorMessage ? `Lỗi kết nối: ${errorMessage}` : 'Chưa kết nối API http://localhost:8000'})
            </h4>
          </div>
          <p style={{ color: 'var(--color-text)', marginBottom: '0.85rem', lineHeight: 1.6 }}>
            <strong>Giải thích cho Vercel / GitHub Preview:</strong> Khi deploy Frontend lên Vercel, ứng dụng hoạt động mượt mà ở chế độ Static View. Để trải nghiệm đầy đủ khả năng AI RAG (nạp PDF, tạo Vector ChromaDB), bạn chỉ cần bật trạm Backend Python song song trên máy tính:
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '0.75rem',
            marginTop: '1rem'
          }}>
            <div style={{ padding: '0.85rem', backgroundColor: 'rgba(6, 8, 20, 0.85)', borderRadius: '10px', border: '1px solid rgba(141, 122, 255, 0.3)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-accent)', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>⚡ CHẠY SONG SONG QUA DOCKER</span>
              <code style={{ color: '#fff', fontFamily: 'monospace', fontSize: '0.9rem' }}>make dev</code>
            </div>
            <div style={{ padding: '0.85rem', backgroundColor: 'rgba(6, 8, 20, 0.85)', borderRadius: '10px', border: '1px solid rgba(141, 122, 255, 0.3)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-cyan)', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>🐍 CHẠY BACKEND PYTHON TRỰC TIẾP</span>
              <code style={{ color: '#fff', fontFamily: 'monospace', fontSize: '0.82rem' }}>cd backend && .venv/bin/uvicorn app.main:app</code>
            </div>
          </div>
        </div>
      )}

      {connectionState === 'online' && health && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.15rem', marginBottom: '1.75rem' }}>
          <div style={{ 
            padding: '1.25rem', 
            background: 'linear-gradient(135deg, rgba(28, 38, 76, 0.8), rgba(21, 27, 54, 0.9))', 
            borderRadius: 'var(--radius-sm)', 
            border: '1px solid rgba(141, 122, 255, 0.3)',
            boxShadow: '0 8px 25px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--color-primary-light)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              <ShieldCheck size={18} color="var(--color-primary)" /> API Contract
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff' }}>v{health.version}</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', display: 'block', marginTop: '0.25rem' }}>✓ Đạt chuẩn STUDYRAG_PROJECT.md</span>
          </div>

          <div style={{ 
            padding: '1.25rem', 
            background: 'linear-gradient(135deg, rgba(28, 38, 76, 0.8), rgba(21, 27, 54, 0.9))', 
            borderRadius: 'var(--radius-sm)', 
            border: '1px solid rgba(247, 197, 107, 0.3)',
            boxShadow: '0 8px 25px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--color-accent)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              <Rocket size={18} color="var(--color-accent)" /> Môi trường trạm
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff', textTransform: 'capitalize' }}>{health.environment}</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'block', marginTop: '0.25rem' }}>⚡ Tối ưu Asyncio & Pydantic</span>
          </div>

          <div style={{ 
            padding: '1.25rem', 
            background: 'linear-gradient(135deg, rgba(28, 38, 76, 0.8), rgba(21, 27, 54, 0.9))', 
            borderRadius: 'var(--radius-sm)', 
            border: '1px solid rgba(52, 211, 153, 0.3)',
            boxShadow: '0 8px 25px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--color-success)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              <Database size={18} color="var(--color-success)" /> Storage Engine
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff' }}>
              {ready?.database === 'sqlite_ready' ? 'SQLite Ready' : 'Standby'}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-cyan)', display: 'block', marginTop: '0.25rem' }}>📦 ChromaDB Vector Store</span>
          </div>

          <div style={{ 
            padding: '1.25rem', 
            background: 'linear-gradient(135deg, rgba(28, 38, 76, 0.8), rgba(21, 27, 54, 0.9))', 
            borderRadius: 'var(--radius-sm)', 
            border: '1px solid rgba(192, 132, 252, 0.3)',
            boxShadow: '0 8px 25px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: '#c084fc', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              <Cpu size={18} color="#c084fc" /> AI Embedding
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ready?.embedding_provider || 'Sentence Transformers'}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'block', marginTop: '0.25rem' }}>🧠 Vietnamese Bi-Encoder</span>
          </div>
        </div>
      )}

      {/* Card Footer */}
      <div style={{ 
        borderTop: '1px solid rgba(141, 122, 255, 0.2)', 
        paddingTop: '1.15rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        fontSize: '0.82rem', 
        color: 'var(--color-muted)', 
        flexWrap: 'wrap', 
        gap: '0.75rem' 
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Zap size={15} color="var(--color-accent)" /> Cấu trúc hệ thống tuân thủ tuyệt đối quy định trong <strong style={{ color: 'var(--color-text)' }}>STUDYRAG_PROJECT.md</strong>
        </span>
        {health?.timestamp && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-cyan)' }}>
            <Clock size={15} /> Đồng hồ trạm: {new Date(health.timestamp).toLocaleTimeString('vi-VN')}
          </span>
        )}
      </div>
    </div>
  );
};
