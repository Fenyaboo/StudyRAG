import React from 'react';
import { ShieldCheck, Server, Database, Cpu, Clock, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';
import { HealthStatus, ReadyStatus, ConnectionState } from '../../types';

interface StatusCardProps {
  connectionState: ConnectionState;
  health: HealthStatus | null;
  ready: ReadyStatus | null;
  latencyMs: number;
  errorMessage?: string;
  onRefresh: () => void;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  connectionState,
  health,
  ready,
  latencyMs,
  errorMessage,
  onRefresh
}) => {
  const isOk = connectionState === 'connected';

  return (
    <div className="glass-card" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: isOk ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${isOk ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
          }}>
            {isOk ? <ShieldCheck size={24} color="var(--color-success)" /> : <AlertTriangle size={24} color="var(--color-danger)" />}
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              System Status & API Telemetry
              {isOk && <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>OPERATIONAL</span>}
            </h3>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>
              {isOk ? `Kết nối ổn định với Backend • Phản hồi trong ${latencyMs}ms` : `Chưa kết nối API • Giao diện đang chạy ở chế độ Offline/Demo`}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {isOk && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--color-border)',
              fontSize: '0.78rem',
              color: 'var(--color-muted)'
            }}>
              <Zap size={14} color="var(--color-accent)" /> Latency: <strong style={{ color: '#fff' }}>{latencyMs}ms</strong>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {/* API Core */}
        <div style={{
          padding: '1rem',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--color-border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', color: 'var(--color-muted)', fontSize: '0.82rem' }}>
            <Server size={15} color="var(--color-primary-light)" /> Backend API Core
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)' }}>
            {health?.status === 'ok' ? (
              <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <CheckCircle2 size={16} /> v{health.version} ({health.environment})
              </span>
            ) : (
              <span style={{ color: 'var(--color-danger)', fontSize: '0.9rem' }}>
                {errorMessage || 'Disconnected (localhost:8000)'}
              </span>
            )}
          </div>
        </div>

        {/* Database & Vector Store */}
        <div style={{
          padding: '1rem',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--color-border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', color: 'var(--color-muted)', fontSize: '0.82rem' }}>
            <Database size={15} color="var(--color-accent)" /> Vector Storage Engine
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text)' }}>
            {ready?.status === 'ready' ? (
              <span style={{ color: 'var(--color-accent)', fontSize: '0.92rem' }}>
                Supabase pgvector / SQLite
              </span>
            ) : (
              <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Chưa kiểm tra</span>
            )}
          </div>
        </div>

        {/* AI Models */}
        <div style={{
          padding: '1rem',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--color-border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', color: 'var(--color-muted)', fontSize: '0.82rem' }}>
            <Cpu size={15} color="var(--color-success)" /> AI RAG Engine
          </div>
          <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--color-text)' }}>
            {ready ? (
              <span style={{ color: 'var(--color-text)' }}>
                Embedding: {ready.embedding_provider.split('/')[0]} <br/>
                LLM: {ready.llm_provider} (Ready for Gemini/Ollama)
              </span>
            ) : (
              <span style={{ color: 'var(--color-muted)' }}>M1/M2/M3 Engine Pipeline</span>
            )}
          </div>
        </div>

        {/* Server Time */}
        <div style={{
          padding: '1rem',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--color-border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', color: 'var(--color-muted)', fontSize: '0.82rem' }}>
            <Clock size={15} /> Thời Gian Máy Chủ
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--color-text)' }}>
            {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString('vi-VN') : new Date().toLocaleTimeString('vi-VN')}
          </div>
        </div>
      </div>
    </div>
  );
};
