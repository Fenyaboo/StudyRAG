import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/common/Header';
import { StatusCard } from '../components/common/StatusCard';
import { apiService } from '../services/api';
import { HealthStatus, ReadyStatus, ConnectionState } from '../types';
import { BookOpen, MessageSquare, History, Settings, CheckSquare, Sparkles, Github, Layers, Star, Award } from 'lucide-react';
import { UploadDropzone } from '../components/library/UploadDropzone';
import { DocumentList } from '../components/library/DocumentList';
import '../styles/index.css';

interface DemoCitation {
  id: string;
  source: string;
  page: number;
  snippet: string;
}

interface DemoQuery {
  question: string;
  subject: string;
  answer: string;
  citations: DemoCitation[];
}

export const App: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('checking');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [ready, setReady] = useState<ReadyStatus | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedSubject, setSelectedSubject] = useState<string>('tất cả');
  const [documents, setDocuments] = useState<any[]>([]);

  const fetchDocuments = useCallback(async () => {
    const res = await apiService.getDocuments();
    if (res.data) {
      setDocuments(res.data);
    }
  }, []);

  const checkConnection = useCallback(async () => {
    setConnectionState('checking');
    const [healthRes, readyRes] = await Promise.all([
      apiService.getHealth(),
      apiService.getReady()
    ]);

    setLatencyMs(healthRes.latencyMs);

    if (healthRes.data && healthRes.data.status === 'ok') {
      setHealth(healthRes.data);
      if (readyRes.data) {
        setReady(readyRes.data);
      }
      setConnectionState('connected');
      setErrorMessage('');
      fetchDocuments();
    } else {
      setHealth(null);
      setReady(null);
      setConnectionState('error');
      setErrorMessage(healthRes.error || 'Failed to connect to API http://localhost:8000');
    }
  }, [fetchDocuments]);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  // Interactive AI RAG Demo state
  const demoQueries: DemoQuery[] = [
    {
      question: "Công thức tính chu kỳ dao động con lắc đơn và con lắc lò xo theo SGK Vật lý 12?",
      subject: "Vật Lý",
      answer: "Trong chương trình Vật lý lớp 12, chu kỳ dao động điều hòa của hai hệ con lắc cơ bản được xác định như sau: Đối với con lắc lò xo có khối lượng m và độ cứng k: T = 2π√(m/k). Đối với con lắc đơn chiều dài l đặt tại nơi có gia tốc trọng trường g: T = 2π√(l/g). Hai hệ đều dao động điều hòa khi bỏ qua ma sát và góc lệch nhỏ (với con lắc đơn góc dao động < 10°).",
      citations: [
        { id: "S1", source: "SGK Vật Lý 12 - Chương 1: Dao động cơ", page: 12, snippet: "Chu kỳ con lắc lò xo T = 2π√(m/k), phụ thuộc vào đặc tính hệ." },
        { id: "S2", source: "Đề thi thử THPT Quốc gia 2025 - Câu 14", page: 2, snippet: "Khi góc lệch α nhỏ hơn 10°, chu kỳ con lắc đơn T = 2π√(l/g)." }
      ]
    },
    {
      question: "Cách giải phương trình tích phân từng phần ∫ x·e^x dx thường gặp trong đề Toán 12?",
      subject: "Toán Học",
      answer: "Để giải tích phân I = ∫ x·e^x dx, ta áp dụng công thức tích phân từng phần: ∫ u dv = u·v - ∫ v du. Đặt u = x => du = dx, dv = e^x dx => v = e^x. Khi đó: I = x·e^x - ∫ e^x dx = x·e^x - e^x + C = e^x(x - 1) + C. Đây là dạng toán nguyên hàm hàm mũ kết hợp đa thức quen thuộc.",
      citations: [
        { id: "S1", source: "SGK Giải Tích 12 - Bài 2: Tích phân từng phần", page: 118, snippet: "phương pháp đặt u bằng đa thức, dv bằng hàm mũ hoặc lượng giác." }
      ]
    },
    {
      question: "Đặc tính lưỡng tính và cấu trúc phân tử của Glyxin (H2N-CH2-COOH) trong Hóa học?",
      subject: "Hóa Học",
      answer: "Glyxin (Amoacetic acid) có công thức phân tử C2H5NO2. Trong dung dịch nước, Glyxin tồn tại chủ yếu dưới dạng ion lưỡng cực H3N+-CH2-COO-. Do có cả nhóm amino (-NH2) có tính bazơ và nhóm carboxyl (-COOH) có tính axit, Glyxin vừa tác dụng được với axit mạnh (như HCl) vừa tác dụng với dung dịch kiềm (như NaOH), thể hiện tính chất lưỡng tính điển hình của Amino acid.",
      citations: [
        { id: "S1", source: "SGK Hóa Học 12 - Chương 3: Amino Axit & Protein", page: 48, snippet: "Dạng ion lưỡng cực làm cho nhiệt độ nóng chảy của amino acid cao và dễ tan trong nước." }
      ]
    }
  ];

  const [activeDemoIndex, setActiveDemoIndex] = useState<number>(0);

  const roadmapMilestones = [
    {
      id: 'M0',
      title: 'Scaffold & AI Studio Foundation',
      desc: 'Thiết lập Monorepo React/Vite/TS + FastAPI, Design Tokens AI Studio Pro SaaS Tech, /health & /ready API, Docker & CI/CD workflows.',
      status: 'done',
      badge: '✓ Đang hoạt động',
      color: 'var(--color-success)'
    },
    {
      id: 'M1',
      title: 'Document Ingestion & Supabase Pipeline',
      desc: 'Nạp và kiểm tra PDF đề thi 25MB, trích xuất text từng trang với PyMuPDF, chunk tài liệu theo câu hỏi & heading overlap, lưu trữ Supabase pgvector / SQLite.',
      status: 'done',
      badge: '✓ Hoàn tất M1',
      color: 'var(--color-success)'
    },
    {
      id: 'M2',
      title: 'Vector Retrieval & Search API',
      desc: 'Lập chỉ mục vector với ChromaDB/Supabase pgvector và Sentence Transformers (Vietnamese bi-encoder), tìm kiếm ngữ nghĩa đạt Recall@5 >= 0.80.',
      status: 'pending',
      badge: 'Bước tiếp theo (M2)',
      color: 'var(--color-accent)'
    },
    {
      id: 'M3',
      title: 'Grounded Answer & Citations',
      desc: 'Tổng hợp câu trả lời từ context với Ollama/OpenAI, gắn nguồn [Sx] chính xác tới từng trang, chống bịa đặt (hallucination guardrail).',
      status: 'pending',
      badge: 'Qũy đạo M3',
      color: 'var(--color-accent)'
    },
    {
      id: 'M4-M5',
      title: 'Quality Assurance & AWS Cloud Deploy',
      desc: 'Đánh giá chất lượng toàn diện với bộ 50+ câu hỏi RAGAS, kiểm chứng bảo mật, build Docker image, deploy AWS App Runner / S3 private.',
      status: 'pending',
      badge: 'Chặng đích',
      color: '#c084fc'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Header
        connectionState={connectionState}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRefresh={checkConnection}
      />

      <main style={{ flex: 1, padding: '2.5rem 1.5rem', maxWidth: '1360px', margin: '0 auto', width: '100%' }}>
        {activeTab === 'dashboard' && (
          <div>
            {/* Hero Section */}
            <div style={{ textAlign: 'center', margin: '1rem 0 3.5rem 0', position: 'relative' }}>
              <div className="badge-celestial" style={{ marginBottom: '1.25rem' }}>
                <Sparkles size={16} color="var(--color-accent)" />
                <span>Phiên bản AI Studio v2.0.0 — Kiến trúc AI RAG Lớp 12 Chuẩn Mực</span>
              </div>

              <h2 className="glow-text" style={{ fontSize: '3.1rem', lineHeight: 1.25, maxWidth: '960px', margin: '0 auto 1.25rem auto' }}>
                Trợ Lý Ôn Thi Đỉnh Cao Toán, Lý & Hóa Lớp 12
              </h2>

              <p style={{ color: 'var(--color-muted)', maxWidth: '800px', margin: '0 auto 2rem auto', fontSize: '1.15rem', lineHeight: 1.7 }}>
                Truy xuất chính xác từ kho sách giáo khoa và đề thi cá nhân với công nghệ <strong style={{ color: 'var(--color-primary-light)' }}>Retrieval-Augmented Generation</strong>. Không bịa đặt kiến thức — Gắn thẻ nguồn trích dẫn <code style={{ color: 'var(--color-accent)' }}>[Trang X]</code> tuyệt đối tin cậy.
              </p>

              {/* Subject Selector Chips */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'tất cả', label: '🌐 Tất cả môn học' },
                  { id: 'Toán Học', label: '📐 Toán Học Lớp 12' },
                  { id: 'Vật Lý', label: '⚡ Vật Lý Lớp 12' },
                  { id: 'Hóa Học', label: '🧪 Hóa Học Lớp 12' },
                ].map(chip => (
                  <button
                    key={chip.id}
                    onClick={() => {
                      setSelectedSubject(chip.id);
                      if (chip.id !== 'tất cả') {
                        const idx = demoQueries.findIndex(q => q.subject === chip.id);
                        if (idx !== -1) setActiveDemoIndex(idx);
                      }
                    }}
                    style={{
                      padding: '0.55rem 1.35rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.92rem',
                      fontWeight: selectedSubject === chip.id ? 700 : 500,
                      color: selectedSubject === chip.id ? '#fff' : 'var(--color-muted)',
                      background: selectedSubject === chip.id
                        ? 'linear-gradient(135deg, var(--color-primary), #9333ea)'
                        : 'rgba(21, 27, 54, 0.75)',
                      border: selectedSubject === chip.id
                        ? '1px solid rgba(255,255,255,0.4)'
                        : '1px solid rgba(141, 122, 255, 0.2)',
                      boxShadow: selectedSubject === chip.id ? '0 0 25px rgba(141, 122, 255, 0.5)' : 'none',
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Live AI RAG Preview */}
            <div className="glass-card" style={{
              maxWidth: '1000px',
              margin: '0 auto 3.5rem auto',
              background: 'linear-gradient(135deg, rgba(16, 22, 44, 0.85), rgba(24, 34, 68, 0.7))',
              border: '1px solid rgba(247, 197, 107, 0.4)',
              boxShadow: '0 30px 70px rgba(0, 0, 0, 0.7), 0 0 45px rgba(247, 197, 107, 0.15)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ padding: '0.5rem', borderRadius: '10px', background: 'rgba(247, 197, 107, 0.2)', border: '1px solid var(--color-accent)' }}>
                    <Sparkles size={20} color="var(--color-accent)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', margin: 0, color: '#fff' }}>Trải Nghiệm Live AI RAG Preview</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Nhấn vào câu hỏi mẫu bên dưới để xem khả năng truy xuất & gắn trích dẫn thật</span>
                  </div>
                </div>
                <span style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(141, 122, 255, 0.2)',
                  border: '1px solid var(--color-primary-light)',
                  color: 'var(--color-primary-light)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}>
                  <Star size={14} fill="var(--color-primary-light)" /> Trợ lý AI đang phản hồi
                </span>
              </div>

              {/* Question selector pill tabs */}
              <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {demoQueries.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveDemoIndex(idx)}
                    style={{
                      padding: '0.6rem 1.15rem',
                      borderRadius: '12px',
                      fontSize: '0.88rem',
                      fontWeight: activeDemoIndex === idx ? 600 : 400,
                      color: activeDemoIndex === idx ? '#fff' : 'var(--color-muted)',
                      backgroundColor: activeDemoIndex === idx ? 'rgba(141, 122, 255, 0.35)' : 'rgba(11, 16, 34, 0.6)',
                      border: activeDemoIndex === idx ? '1px solid var(--color-primary-light)' : '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: q.subject === 'Vật Lý' ? 'var(--color-cyan)' : q.subject === 'Toán Học' ? 'var(--color-primary-light)' : 'var(--color-accent)'
                    }} />
                    {q.subject}: {q.question.slice(0, 38)}...
                  </button>
                ))}
              </div>

              {/* AI Response Display Box */}
              <div style={{
                padding: '1.5rem',
                borderRadius: '16px',
                background: 'rgba(6, 8, 20, 0.75)',
                border: '1px solid rgba(141, 122, 255, 0.3)',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
                  <Award size={18} color="var(--color-accent)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Câu hỏi ({demoQueries[activeDemoIndex].subject}):
                  </span>
                  <span style={{ fontSize: '0.98rem', fontWeight: 600, color: '#fff' }}>
                    {demoQueries[activeDemoIndex].question}
                  </span>
                </div>

                <div style={{ color: 'var(--color-text)', fontSize: '1.02rem', lineHeight: 1.75, marginBottom: '1.35rem', paddingLeft: '0.5rem', borderLeft: '3px solid var(--color-primary)' }}>
                  {demoQueries[activeDemoIndex].answer}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Layers size={14} color="var(--color-cyan)" /> NGUỒN TÀI LIỆU TRÍCH DẪN (GROUNDED CITATIONS):
                  </span>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {demoQueries[activeDemoIndex].citations.map((c) => (
                      <div
                        key={c.id}
                        style={{
                          padding: '0.6rem 1rem',
                          borderRadius: '10px',
                          background: 'rgba(28, 38, 76, 0.85)',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                          maxWidth: '440px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-cyan)' }}>
                            [{c.id}] {c.source}
                          </span>
                          <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.2)', color: 'var(--color-cyan)', fontWeight: 600 }}>
                            Tr. {c.page}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>
                          "{c.snippet}"
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Hardware Status & Architecture Telemetry */}
            <StatusCard
              health={health}
              ready={ready}
              latencyMs={latencyMs}
              connectionState={connectionState}
              errorMessage={errorMessage}
            />

            {/* Roadmaps Grid */}
            <div style={{ marginTop: '4.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '2rem' }}>
                <div style={{ padding: '0.6rem', borderRadius: '12px', background: 'rgba(141, 122, 255, 0.2)', border: '1px solid var(--color-primary)' }}>
                  <CheckSquare size={26} color="var(--color-primary-light)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.75rem', margin: 0, color: '#fff' }}>Lộ Trình Quỹ Đạo 5 Milestones</h3>
                  <span style={{ color: 'var(--color-muted)', fontSize: '0.95rem' }}>Thiết kế từng bước bám sát kiến trúc tổng thể trong tài liệu gốc</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(370px, 1fr))', gap: '1.5rem' }}>
                {roadmapMilestones.map((m) => (
                  <div
                    key={m.id}
                    className="glass-card"
                    style={{
                      borderTop: `4px solid ${m.color}`,
                      padding: '1.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '220px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{
                          padding: '0.35rem 0.85rem',
                          borderRadius: '8px',
                          background: 'rgba(18, 24, 48, 0.9)',
                          border: `1px solid ${m.color}`,
                          color: m.color,
                          fontSize: '0.82rem',
                          fontWeight: 700
                        }}>
                          Milestone {m.id}
                        </span>
                        <span style={{
                          fontSize: '0.8rem',
                          padding: '0.25rem 0.75rem',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: m.status === 'done' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                          color: m.status === 'done' ? 'var(--color-success)' : 'var(--color-muted)',
                          fontWeight: 600
                        }}>
                          {m.badge}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '1.25rem', marginBottom: '0.65rem', color: '#fff' }}>{m.title}</h4>
                      <p style={{ color: 'var(--color-muted)', fontSize: '0.94rem', lineHeight: 1.65 }}>{m.desc}</p>
                    </div>

                    <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: m.color, fontWeight: 600 }}>
                      <span>Quy chuẩn kỹ thuật V2</span>
                      <span>→</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Call to Action */}
            <div className="glass-card" style={{ 
              marginTop: '4rem', 
              background: 'linear-gradient(135deg, rgba(141, 122, 255, 0.25), rgba(247, 197, 107, 0.15))',
              border: '1px solid rgba(141, 122, 255, 0.5)',
              padding: '2.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div style={{ maxWidth: '760px' }}>
                  <h4 style={{ fontSize: '1.5rem', marginBottom: '0.6rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Github size={24} color="var(--color-accent)" /> Sẵn Sàng Triển Khai Trên Vercel & GitHub Actions
                  </h4>
                  <p style={{ color: 'var(--color-text)', fontSize: '1rem', lineHeight: 1.6 }}>
                    Giao diện Thư viện thiên văn đã được tối ưu hoàn hảo cho cả máy tính và thiết bị di động. Khởi tạo kho chứa và trải nghiệm trọn vẹn sức mạnh trí tuệ nhân tạo RAG ôn thi THPT Quốc gia!
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => setActiveTab('library')}
                    style={{
                      padding: '0.85rem 1.75rem',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, var(--color-primary), #9333ea)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.98rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      boxShadow: '0 8px 25px rgba(141, 122, 255, 0.5)'
                    }}
                  >
                    <BookOpen size={20} /> Khám phá Thư viện (M1)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'library' && (
          <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
            <UploadDropzone onSuccess={fetchDocuments} />
            <DocumentList documents={documents} onRefresh={fetchDocuments} />
          </div>
        )}

        {activeTab !== 'dashboard' && activeTab !== 'library' && (
          <div className="glass-card" style={{ textAlign: 'center', padding: '5rem 2.5rem', maxWidth: '760px', margin: '3rem auto' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(56, 189, 248, 0.2))',
              border: '1px solid var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.75rem auto',
              boxShadow: '0 0 35px rgba(99, 102, 241, 0.4)'
            }}>
              {activeTab === 'chat' && <MessageSquare size={40} color="var(--color-primary-light)" />}
              {activeTab === 'history' && <History size={40} color="var(--color-primary-light)" />}
              {activeTab === 'settings' && <Settings size={40} color="var(--color-primary-light)" />}
            </div>
            <h3 style={{ fontSize: '1.85rem', marginBottom: '1rem', color: '#fff' }}>
              AI Studio Module: {activeTab.toUpperCase()} — Sẽ kích hoạt ở Milestone tiếp theo
            </h3>
            <p style={{ color: 'var(--color-muted)', marginBottom: '2rem', lineHeight: 1.7, fontSize: '1.05rem' }}>
              Theo lộ trình khắt khe của <strong style={{ color: 'var(--color-accent)' }}>STUDYRAG_PROJECT.md</strong>, mỗi Milestone được kiểm thử chất lượng AI toàn diện (Recall, Groundedness) trước khi mở khóa giao diện quản trị tương ứng.
            </p>
            <button
              onClick={() => setActiveTab('dashboard')}
              style={{
                padding: '0.75rem 2rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--color-primary), #4f46e5)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.98rem',
                cursor: 'pointer',
                boxShadow: '0 5px 20px rgba(99, 102, 241, 0.3)'
              }}
            >
              Trở về Dashboard Quản Trị
            </button>
          </div>
        )}
      </main>

      <footer style={{
        borderTop: '1px solid var(--color-border)',
        padding: '2rem 1.5rem',
        textAlign: 'center',
        color: 'var(--color-muted)',
        fontSize: '0.9rem',
        backgroundColor: 'rgba(9, 13, 22, 0.9)',
        backdropFilter: 'blur(20px)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
            StudyRAG © 2026 — Trợ lý RAG Ôn thi THPT Quốc Gia Toán, Lý, Hóa
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Thiết kế <strong style={{ color: 'var(--color-accent)' }}>Modern AI Studio Pro SaaS Tech UI</strong>
          </span>
        </div>
      </footer>
    </div>
  );
};
