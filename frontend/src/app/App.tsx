import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/common/Header';
import { StatusCard } from '../components/common/StatusCard';
import { apiService } from '../services/api';
import { HealthStatus, ReadyStatus, ConnectionState } from '../types';
import { BookOpen, MessageSquare, History, Settings, CheckSquare, Sparkles, Github } from 'lucide-react';
import '../styles/index.css';

export const App: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('checking');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [ready, setReady] = useState<ReadyStatus | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const checkConnection = useCallback(async () => {
    setConnectionState('checking');
    const healthRes = await apiService.getHealth();
    
    if (healthRes.data) {
      setHealth(healthRes.data);
      setLatencyMs(healthRes.latencyMs);
      const readyRes = await apiService.getReady();
      setReady(readyRes.data);
      setConnectionState('online');
      setErrorMessage('');
    } else {
      setHealth(null);
      setReady(null);
      setConnectionState('offline');
      setErrorMessage(healthRes.error || 'Failed to connect to API');
    }
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [checkConnection]);

  const roadmapMilestones = [
    {
      id: 'M0',
      title: 'Milestone 0 — Scaffold & Fantasy UI Foundation',
      desc: 'Thiết lập Monorepo React/Vite/TS + FastAPI, Design Tokens Thiên văn, /health & /ready API, Docker & CI/CD workflows chuẩn bị deploy Github/Vercel.',
      status: 'done'
    },
    {
      id: 'M1',
      title: 'Milestone 1 — Document Ingestion Pipeline',
      desc: 'Nạp và kiểm tra PDF 25MB, trích xuất text từng trang với PyMuPDF, chunk đề thi/sách theo câu hỏi & heading overlap, lưu trữ JSONL và SQLite.',
      status: 'pending'
    },
    {
      id: 'M2',
      title: 'Milestone 2 — Vector Retrieval & Search API',
      desc: 'Lập chỉ mục vector local với ChromaDB và Sentence Transformers (Vietnamese bi-encoder), tìm kiếm ngữ nghĩa tiếng Việt đạt Recall@5 >= 0.80.',
      status: 'pending'
    },
    {
      id: 'M3',
      title: 'Milestone 3 — Grounded Answer & Citations',
      desc: 'Tổng hợp câu trả lời từ context với Ollama/OpenAI, gắn nguồn [Sx] chính xác, kiểm chứng không bịa đặt khi tài liệu chưa đủ thông tin.',
      status: 'pending'
    },
    {
      id: 'M4-M5',
      title: 'Milestone 4 & 5 — Quality Assurance & AWS Cloud Deploy',
      desc: 'Đánh giá chất lượng toàn diện, kiểm chứng bảo mật, build Docker image, và sẵn sàng deploy lên AWS App Runner / S3 private bucket.',
      status: 'pending'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        connectionState={connectionState}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRefresh={checkConnection}
      />

      <main style={{ flex: 1, padding: '2rem', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ textAlign: 'center', margin: '1.5rem 0 3rem 0' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 1rem',
                borderRadius: '24px',
                backgroundColor: 'rgba(141, 122, 255, 0.15)',
                border: '1px solid rgba(141, 122, 255, 0.3)',
                color: 'var(--color-primary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                marginBottom: '1rem'
              }}>
                <Sparkles size={16} color="var(--color-accent)" /> Phiên bản v2.0.0 — Sẵn sàng cho GitHub & Vercel
              </div>
              <h2 className="glow-text" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
                Trợ lý Ôn thi Toán, Vật lý & Hóa học Lớp 12
              </h2>
              <p style={{ color: 'var(--color-muted)', maxWidth: '720px', margin: '0 auto', fontSize: '1.05rem' }}>
                Hệ thống RAG (Retrieval-Augmented Generation) bám sát tài liệu cá nhân, không bịa kiến thức, gắn trích dẫn chính xác từng trang sách và câu hỏi đề thi.
              </p>
            </div>

            <StatusCard
              health={health}
              ready={ready}
              latencyMs={latencyMs}
              connectionState={connectionState}
              errorMessage={errorMessage}
            />

            <div style={{ marginTop: '3.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <CheckSquare size={24} color="var(--color-accent)" />
                <h3 style={{ fontSize: '1.5rem' }}>Lộ trình triển khai theo STUDYRAG_PROJECT.md</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
                {roadmapMilestones.map((m) => (
                  <div
                    key={m.id}
                    className="glass-card"
                    style={{
                      borderLeft: m.status === 'done' ? '4px solid var(--color-success)' : '4px solid rgba(141, 122, 255, 0.3)',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        backgroundColor: m.status === 'done' ? 'rgba(116, 212, 173, 0.15)' : 'rgba(141, 122, 255, 0.15)',
                        color: m.status === 'done' ? 'var(--color-success)' : 'var(--color-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {m.id}
                      </span>
                      {m.status === 'done' && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-success)', fontWeight: 600 }}>
                          ✓ Hoàn thành
                        </span>
                      )}
                    </div>
                    <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--color-text)' }}>{m.title}</h4>
                    <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card" style={{ marginTop: '3rem', background: 'linear-gradient(135deg, rgba(21, 27, 54, 0.9), rgba(27, 35, 66, 0.9))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '1.2rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Github size={20} color="var(--color-text)" /> Hướng dẫn Test Deploy lên Vercel & GitHub
                  </h4>
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>
                    Dự án đã được cấu hình sẵn file <code style={{ color: 'var(--color-accent)' }}>vercel.json</code> và GitHub Actions CI. Bạn chỉ cần commit lên GitHub và kết nối Vercel với Root Directory là <code style={{ color: 'var(--color-accent)' }}>/</code> (hoặc <code style={{ color: 'var(--color-accent)' }}>frontend</code>).
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => setActiveTab('library')}
                    style={{
                      padding: '0.6rem 1.25rem',
                      borderRadius: '8px',
                      background: 'var(--color-primary)',
                      color: '#fff',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 15px rgba(141, 122, 255, 0.4)'
                    }}
                  >
                    <BookOpen size={18} /> Khám phá Thư viện
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab !== 'dashboard' && (
          <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem', maxWidth: '700px', margin: '3rem auto' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(141, 122, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem auto'
            }}>
              {activeTab === 'library' && <BookOpen size={32} color="var(--color-primary)" />}
              {activeTab === 'chat' && <MessageSquare size={32} color="var(--color-primary)" />}
              {activeTab === 'history' && <History size={32} color="var(--color-primary)" />}
              {activeTab === 'settings' && <Settings size={32} color="var(--color-primary)" />}
            </div>
            <h3 style={{ fontSize: '1.6rem', marginBottom: '0.75rem' }}>
              Màn hình {activeTab.toUpperCase()} — Sẽ mở trong Milestone tiếp theo
            </h3>
            <p style={{ color: 'var(--color-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Theo đúng quy tắc kiến trúc và lộ trình trong <code style={{ color: 'var(--color-accent)' }}>STUDYRAG_PROJECT.md</code>, mỗi Milestone được thực thi hoàn chỉnh từng bước để đảm bảo chất lượng AI retrieval cao nhất.
            </p>
            <button
              onClick={() => setActiveTab('dashboard')}
              style={{
                padding: '0.6rem 1.5rem',
                borderRadius: '8px',
                backgroundColor: 'var(--color-surface-raised)',
                border: '1px solid var(--color-primary)',
                color: 'var(--color-text)',
                fontWeight: 500
              }}
            >
              Quay lại Dashboard
            </button>
          </div>
        )}
      </main>

      <footer style={{
        borderTop: '1px solid rgba(141, 122, 255, 0.12)',
        padding: '1.5rem',
        textAlign: 'center',
        color: 'var(--color-muted)',
        fontSize: '0.85rem'
      }}>
        StudyRAG V2 © 2026 — RAG Ôn thi Toán, Lý, Hóa Lớp 12 | Thiết kế Fantasy Thư viện thiên văn
      </footer>
    </div>
  );
};
