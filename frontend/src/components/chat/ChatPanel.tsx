import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, BookOpen, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';
import { ChatMessage, CitationItem } from '../../types';
import { apiService } from '../../services/api';

interface ChatPanelProps {
  documents: any[];
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ documents }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '👋 **Chào bạn đến với Trạm Hỏi Đáp AI RAG (Milestone 2 & 3)!**\n\nHệ thống đã nạp thành công các đề thi & tài liệu Toán, Lý, Hóa (như **`e1b1.pdf` - Kĩ năng tìm khoảng cách**). Bạn hãy chọn một gợi ý bên dưới hoặc gõ câu hỏi bất kỳ để AI phân tích và trích dẫn trực tiếp từ trang đề thi nhé!',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      provider: 'NVIDIA NIM / Gemini'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [activeCitation, setActiveCitation] = useState<CitationItem | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const samplePrompts = [
    "Tính khoảng cách từ A đến (SBC) trong Ví dụ 1 trang 1",
    "Tóm tắt tính chất của tam diện vuông trong Lưu ý 2 trang 3",
    "Đáp án và hướng giải câu 3 phần Bài tập rèn luyện trang 4",
    "Phương pháp tìm khoảng cách từ trọng tâm G đến mặt bên trang 2"
  ];

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInput('');
    setIsLoading(true);
    setActiveCitation(null);

    const { data, error } = await apiService.queryRag(textToSend, selectedDocId || undefined);
    setIsLoading(false);

    if (error || !data) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Lỗi kết nối hoặc xử lý truy vấn RAG:** ${error || 'Không nhận được phản hồi'}\n\n*Vui lòng kiểm tra lại cấu hình API Key (NVIDIA / Gemini) hoặc máy chủ Render.*`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      return;
    }

    const aiMsg: ChatMessage = {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: data.answer,
      citations: data.citations || [],
      provider: data.provider,
      model: data.model,
      latencyMs: data.latency_ms,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, aiMsg]);
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: activeCitation ? '1fr 340px' : '1fr',
      gap: '1.5rem',
      maxWidth: '1300px',
      margin: '0 auto',
      minHeight: '680px',
      transition: 'grid-template-columns 0.3s ease'
    }}>
      {/* Khung Chat chính */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '20px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 45px rgba(0, 0, 0, 0.4)',
        overflow: 'hidden'
      }}>
        {/* Header khung chat */}
        <div style={{
          padding: '1.2rem 1.8rem',
          borderBottom: '1px solid var(--color-border)',
          background: 'rgba(255, 255, 255, 0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--color-primary), #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
            }}>
              <Sparkles size={22} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Trợ Lý RAG Lớp 12 (Toán • Lý • Hóa)
                <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>Milestone 2 & 3 Active</span>
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', margin: 0 }}>
                Hệ thống truy xuất ngữ cảnh (Retrieval) + Suy luận có trích dẫn (Grounded AI)
              </p>
            </div>
          </div>

          {/* Lọc theo tài liệu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <BookOpen size={16} color="var(--color-accent)" />
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--color-border)',
                color: '#fff',
                padding: '0.45rem 0.9rem',
                borderRadius: '10px',
                fontSize: '0.88rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">📚 Tìm kiếm trong TẤT CẢ đề thi ({documents.length} tài liệu)</option>
              {documents.map((doc: any) => (
                <option key={doc.id} value={doc.id}>
                  📄 {doc.filename || doc.title} ({doc.subject || 'Đề thi'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Gợi ý nhanh */}
        <div style={{
          padding: '0.9rem 1.8rem',
          background: 'rgba(99, 102, 241, 0.05)',
          borderBottom: '1px solid rgba(99, 102, 241, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.8rem',
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            💡 Gợi ý nhanh:
          </span>
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p)}
              disabled={isLoading}
              style={{
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                padding: '0.35rem 0.85rem',
                borderRadius: '20px',
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Danh sách tin nhắn */}
        <div style={{
          flex: 1,
          padding: '1.8rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          maxHeight: '520px'
        }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{
              display: 'flex',
              gap: '1rem',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%'
            }}>
              {msg.role === 'assistant' && (
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)'
                }}>
                  <Bot size={20} color="#fff" />
                </div>
              )}

              <div style={{
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, var(--color-primary), #4f46e5)'
                  : 'rgba(30, 41, 59, 0.7)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--color-border)',
                padding: '1.1rem 1.4rem',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                color: '#fff',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.8rem'
              }}>
                <div style={{
                  fontSize: '0.96rem',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.content}
                </div>

                {/* Danh sách trích dẫn Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div style={{
                    marginTop: '0.5rem',
                    paddingTop: '0.8rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <ShieldCheck size={14} /> Nguồn trích dẫn kiểm chứng (Grounded Citations):
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {msg.citations.map((cite, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveCitation(cite)}
                          style={{
                            background: activeCitation?.index === cite.index ? 'var(--color-primary)' : 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            color: '#fff',
                            padding: '0.35rem 0.7rem',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <FileText size={13} color="var(--color-accent)" />
                          <span>[{cite.index}] Trang {cite.page} ({cite.document_name})</span>
                          <span style={{ fontSize: '0.72rem', background: 'rgba(255, 255, 255, 0.15)', padding: '1px 5px', borderRadius: '4px' }}>
                            {Math.round(cite.score * 100)}%
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Telemetry info */}
                {msg.role === 'assistant' && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.75rem',
                    color: 'var(--color-muted)',
                    marginTop: '0.2rem'
                  }}>
                    <span>⏱️ {msg.timestamp}</span>
                    {msg.provider && (
                      <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '6px' }}>
                        ⚡ {msg.provider.toUpperCase()} ({msg.model}) • {msg.latencyMs}ms
                      </span>
                    )}
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <User size={20} color="#fff" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '0.5rem 0' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)'
              }}>
                <Bot size={20} color="#fff" />
              </div>
              <div style={{
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid var(--color-border)',
                padding: '0.9rem 1.4rem',
                borderRadius: '18px',
                color: 'var(--color-accent)',
                fontSize: '0.92rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem'
              }}>
                <Sparkles size={16} className="animate-spin" />
                <span>AI đang đọc hiểu đề thi & tổng hợp lời giải...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Ô nhập liệu Input */}
        <div style={{
          padding: '1.2rem 1.8rem',
          borderTop: '1px solid var(--color-border)',
          background: 'rgba(15, 23, 42, 0.6)',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center'
        }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="💬 Đặt câu hỏi về đề thi Toán, Lý, Hóa của bạn (Ví dụ: Tính khoảng cách từ A đến (SBC)...)"
            disabled={isLoading}
            style={{
              flex: 1,
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid var(--color-border)',
              borderRadius: '14px',
              padding: '0.95rem 1.3rem',
              color: '#fff',
              fontSize: '0.96rem',
              outline: 'none',
              transition: 'border-color 0.2s ease'
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            style={{
              background: isLoading || !input.trim() ? 'rgba(99, 102, 241, 0.4)' : 'linear-gradient(135deg, var(--color-primary), #4f46e5)',
              border: 'none',
              borderRadius: '14px',
              padding: '0.95rem 1.6rem',
              color: '#fff',
              fontWeight: 600,
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: isLoading || !input.trim() ? 'none' : '0 5px 20px rgba(99, 102, 241, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            <span>Gửi</span>
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Bảng xem chi tiết đoạn trích dẫn Citation Panel */}
      {activeCitation && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          borderRadius: '20px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.2rem',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.4)',
          height: 'fit-content'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.8rem' }}>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-accent)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} /> Chi Tiết Trích Dẫn [{activeCitation.index}]
            </h4>
            <button
              onClick={() => setActiveCitation(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700 }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.88rem', color: 'var(--color-text)' }}>
            <div>
              <strong style={{ color: 'var(--color-muted)' }}>📄 Tài liệu nguồn:</strong>
              <div style={{ color: '#fff', fontWeight: 600, marginTop: '2px' }}>{activeCitation.document_name}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ color: 'var(--color-muted)' }}>📌 Vị trí trang:</strong>
                <span style={{ color: 'var(--color-accent)', fontWeight: 700, marginLeft: '6px' }}>Trang {activeCitation.page}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--color-muted)' }}>🎯 Độ liên quan:</strong>
                <span style={{ color: 'var(--color-success)', fontWeight: 700, marginLeft: '6px' }}>{Math.round(activeCitation.score * 100)}%</span>
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            padding: '1rem',
            fontSize: '0.9rem',
            lineHeight: 1.6,
            color: '#e2e8f0',
            maxHeight: '340px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace'
          }}>
            {activeCitation.text}
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle2 size={14} color="var(--color-success)" />
            <span>Xác thực bởi RAG Groundedness Checker</span>
          </div>
        </div>
      )}
    </div>
  );
};
