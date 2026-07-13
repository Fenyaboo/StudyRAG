import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Bot, CheckCircle2, FileText, Send, ShieldCheck, Sparkles, User, X } from 'lucide-react';
import { ChatMessage, CitationItem } from '../../types';
import { apiService } from '../../services/api';
import '../../styles/chat.css';

interface ChatDocument {
  id: string;
  filename?: string;
  title?: string;
  subject?: string;
  status?: string;
}

interface ChatPanelProps {
  documents: ChatDocument[];
  onOpenLibrary: () => void;
}

const samplePrompts = [
  'Tính khoảng cách từ A đến (SBC) trong Ví dụ 1 trang 1',
  'Tóm tắt tính chất của tam diện vuông trong Lưu ý 2 trang 3',
  'Đáp án và hướng giải câu 3 phần Bài tập rèn luyện trang 4',
];

const formatInlineContent = (line: string) => {
  const fragments = line.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);

  return fragments.map((fragment, index) => {
    if (fragment.startsWith('**') && fragment.endsWith('**')) {
      return <strong key={index}>{fragment.slice(2, -2)}</strong>;
    }

    if (fragment.startsWith('`') && fragment.endsWith('`')) {
      return <code key={index}>{fragment.slice(1, -1)}</code>;
    }

    if (fragment.startsWith('*') && fragment.endsWith('*')) {
      return <em key={index}>{fragment.slice(1, -1)}</em>;
    }

    return <React.Fragment key={index}>{fragment}</React.Fragment>;
  });
};

const MessageContent: React.FC<{ content: string }> = ({ content }) => (
  <div className="chat-message__content">
    {content.split('\n').map((line, index) => (
      line.trim()
        ? <p key={`${line}-${index}`}>{formatInlineContent(line)}</p>
        : <div className="chat-message__spacer" key={`spacer-${index}`} aria-hidden="true" />
    ))}
  </div>
);

export const ChatPanel: React.FC<ChatPanelProps> = ({ documents, onOpenLibrary }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: '**Chào bạn, mình là StudyRAG.**\n\nMình sẽ tìm đúng đoạn trong tài liệu của bạn, rồi trả lời kèm nguồn và số trang để bạn kiểm tra lại.',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      provider: 'StudyRAG'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [activeCitation, setActiveCitation] = useState<CitationItem | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(messages.length);

  const searchableDocuments = documents.filter((document) => document.status === undefined || document.status === 'ready');
  const hasSearchableDocuments = searchableDocuments.length > 0;

  useEffect(() => {
    const isNewMessage = messages.length > previousMessageCountRef.current;
    const shouldFollowConversation = isNewMessage || isLoading;
    const container = messagesContainerRef.current;

    if (container && shouldFollowConversation) {
      container.scrollTop = container.scrollHeight;
    }

    previousMessageCountRef.current = messages.length;
  }, [isLoading, messages.length]);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || isLoading || !hasSearchableDocuments) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    if (!queryText) setInput('');
    setIsLoading(true);
    setActiveCitation(null);

    const { data, error } = await apiService.queryRag(textToSend, selectedDocId || undefined);
    setIsLoading(false);

    if (error || !data) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `**Không thể xử lý câu hỏi lúc này.**\n\n${error || 'Không nhận được phản hồi từ máy chủ.'} Hãy thử lại sau ít phút.`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          provider: 'StudyRAG'
        }
      ]);
      return;
    }

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: data.answer,
      citations: data.citations || [],
      provider: data.provider,
      model: data.model,
      latencyMs: data.latency_ms,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((currentMessages) => [...currentMessages, assistantMessage]);
  };

  return (
    <section
      className={`rag-workspace${activeCitation ? ' rag-workspace--with-citation' : ''}`}
      aria-labelledby="chat-title"
    >
      <div className="chat-shell">
        <div className="chat-shell__header">
          <div className="chat-identity">
            <span className="chat-identity__mark" aria-hidden="true">
              <Sparkles size={21} />
            </span>
            <div>
              <span className="chat-identity__eyebrow">Không gian học tập có kiểm chứng</span>
              <h2 id="chat-title">Hỏi bài cùng StudyRAG</h2>
              <p>Nhận lời giải rõ ràng, kèm đoạn tài liệu và số trang liên quan.</p>
            </div>
          </div>

          <label className="document-filter">
            <span><BookOpen size={15} /> Phạm vi tìm kiếm</span>
            <select
              value={selectedDocId}
              onChange={(event) => setSelectedDocId(event.target.value)}
              disabled={!hasSearchableDocuments}
            >
              <option value="">Tất cả tài liệu ({searchableDocuments.length})</option>
              {searchableDocuments.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.filename || document.title || 'Tài liệu chưa đặt tên'}
                  {document.subject ? ` · ${document.subject}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        {hasSearchableDocuments ? (
          <div className="prompt-library" aria-label="Câu hỏi gợi ý">
            <span className="prompt-library__label">Thử hỏi nhanh</span>
            <div className="prompt-library__list">
              {samplePrompts.map((prompt) => (
                <button
                  type="button"
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  disabled={isLoading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-library-banner" role="status">
            <div className="empty-library-banner__icon" aria-hidden="true"><BookOpen size={20} /></div>
            <div>
              <strong>Chưa có tài liệu để AI tra cứu</strong>
              <p>Tải PDF vào thư viện trước để StudyRAG có nguồn trả lời chính xác.</p>
            </div>
            <button type="button" onClick={onOpenLibrary}>Tải tài liệu</button>
          </div>
        )}

        <div className="chat-messages" ref={messagesContainerRef} aria-live="polite">
          {messages.map((message) => {
            const isAssistant = message.role === 'assistant';

            return (
              <article
                className={`chat-message chat-message--${message.role}`}
                key={message.id}
              >
                <div className="chat-message__avatar" aria-hidden="true">
                  {isAssistant ? <Bot size={19} /> : <User size={18} />}
                </div>
                <div className="chat-message__body">
                  <div className="chat-message__label">
                    {isAssistant ? 'StudyRAG' : 'Bạn'}
                  </div>
                  <div className="chat-message__bubble">
                    <MessageContent content={message.content} />

                    {message.citations && message.citations.length > 0 && (
                      <div className="citation-list">
                        <span className="citation-list__title"><ShieldCheck size={15} /> Nguồn đã tìm thấy</span>
                        <div className="citation-list__items">
                          {message.citations.map((citation) => (
                            <button
                              className={activeCitation?.index === citation.index ? 'is-active' : ''}
                              key={`${message.id}-${citation.index}`}
                              type="button"
                              onClick={() => setActiveCitation(citation)}
                            >
                              <FileText size={14} />
                              <span>Trang {citation.page}</span>
                              <span className="citation-list__score">{Math.round(citation.score * 100)}%</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="chat-message__meta">
                    <span>{message.timestamp}</span>
                    {isAssistant && message.provider && (
                      <span>{message.provider}{message.model ? ` · ${message.model}` : ''}{message.latencyMs !== undefined ? ` · ${message.latencyMs} ms` : ''}</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {isLoading && (
            <article className="chat-message chat-message--assistant chat-message--loading">
              <div className="chat-message__avatar" aria-hidden="true"><Bot size={19} /></div>
              <div className="loading-answer">
                <span className="loading-answer__dots" aria-hidden="true"><i /><i /><i /></span>
                AI đang đọc tài liệu và đối chiếu nguồn…
              </div>
            </article>
          )}
        </div>

        <form
          className="chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
        >
          <div className="chat-composer__field">
            <label className="sr-only" htmlFor="rag-question">Câu hỏi cho StudyRAG</label>
            <textarea
              id="rag-question"
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={hasSearchableDocuments
                ? 'Hỏi về nội dung trong tài liệu của bạn…'
                : 'Tải tài liệu để bắt đầu đặt câu hỏi…'}
              disabled={isLoading || !hasSearchableDocuments}
            />
            <span>Enter để gửi · Shift + Enter để xuống dòng</span>
          </div>
          <button
            className="chat-composer__send"
            type="submit"
            disabled={isLoading || !input.trim() || !hasSearchableDocuments}
          >
            <span>Gửi câu hỏi</span>
            <Send size={17} />
          </button>
        </form>
      </div>

      {activeCitation && (
        <aside className="citation-panel" aria-label={`Chi tiết nguồn trang ${activeCitation.page}`}>
          <div className="citation-panel__header">
            <div>
              <span>Nguồn tham khảo</span>
              <h3>Trang {activeCitation.page}</h3>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Đóng chi tiết nguồn"
              onClick={() => setActiveCitation(null)}
            >
              <X size={17} />
            </button>
          </div>
          <div className="citation-panel__source">
            <FileText size={17} />
            <span>{activeCitation.document_name}</span>
          </div>
          <div className="citation-panel__score">
            <span>Độ liên quan</span>
            <strong>{Math.round(activeCitation.score * 100)}%</strong>
          </div>
          <p className="citation-panel__excerpt">{activeCitation.text}</p>
          <div className="citation-panel__verified"><CheckCircle2 size={15} /> Có thể đối chiếu trong tài liệu gốc</div>
        </aside>
      )}
    </section>
  );
};
