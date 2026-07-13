import { type FormEvent, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, CircleAlert, FileText, RefreshCw, Sparkles } from 'lucide-react';
import { ConnectionState } from '../../types';
import '../../styles/dashboard.css';

export interface DashboardDocument {
  id: string;
  filename?: string;
  title?: string;
  status?: string;
}

interface DashboardProps {
  connectionState: ConnectionState;
  errorMessage: string;
  documents: DashboardDocument[];
  onRetry: () => void;
  onOpenChat: (question: string) => void;
  onOpenLibrary: () => void;
}

export const Dashboard = ({
  connectionState,
  errorMessage,
  documents,
  onRetry,
  onOpenChat,
  onOpenLibrary,
}: DashboardProps) => {
  const [question, setQuestion] = useState('');
  const readyDocumentCount = useMemo(
    () => documents.filter((document) => document.status === 'ready').length,
    [documents],
  );
  const isChecking = connectionState === 'checking';
  const hasReadyDocuments = readyDocumentCount > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();

    if (hasReadyDocuments && trimmedQuestion) {
      onOpenChat(trimmedQuestion);
      return;
    }

    if (!isChecking && connectionState !== 'error') onOpenLibrary();
  };

  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard__intro">
        <span className="dashboard__eyebrow"><Sparkles size={15} aria-hidden="true" /> Không gian học có nguồn dẫn</span>
        <h1 id="dashboard-title">Hôm nay mình học gì?</h1>
        <p>Hỏi từ tài liệu riêng của bạn và kiểm tra câu trả lời bằng nguồn tham khảo rõ ràng.</p>
      </div>

      <form className="dashboard-prompt" onSubmit={handleSubmit}>
        <label htmlFor="dashboard-question">Câu hỏi nhanh</label>
        <div className="dashboard-prompt__controls">
          <input
            id="dashboard-question"
            name="dashboard-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={hasReadyDocuments ? 'Ví dụ: Tóm tắt định luật Ohm' : 'Tải tài liệu để bắt đầu đặt câu hỏi'}
            disabled={isChecking || connectionState === 'error'}
          />
          <button type="submit" disabled={isChecking || connectionState === 'error' || (hasReadyDocuments && !question.trim())}>
            {hasReadyDocuments ? 'Hỏi AI' : 'Mở thư viện'}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      </form>

      {isChecking && <p className="dashboard-status" role="status">Đang kết nối với kho tài liệu của bạn…</p>}
      {connectionState === 'error' && (
        <div className="dashboard-status dashboard-status--error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{errorMessage || 'Không thể kết nối đến StudyRAG.'}</span>
          <button type="button" onClick={onRetry}><RefreshCw size={15} aria-hidden="true" /> Thử lại</button>
        </div>
      )}

      <div className="dashboard__cards">
        <article className="dashboard-card">
          <span className="dashboard-card__icon" aria-hidden="true"><FileText size={21} /></span>
          <div>
            <p>Tài liệu sẵn sàng</p>
            <strong>{readyDocumentCount} tài liệu sẵn sàng</strong>
            <span>{documents.length === 1 ? '1 tài liệu trong thư viện' : `${documents.length} tài liệu trong thư viện`}</span>
          </div>
        </article>
        <article className="dashboard-card dashboard-card--action">
          <span className="dashboard-card__icon" aria-hidden="true"><BookOpen size={21} /></span>
          <div>
            <p>{hasReadyDocuments ? 'Sẵn sàng để hỏi bài' : 'Chưa có tài liệu sẵn sàng'}</p>
            <span>{hasReadyDocuments ? 'Nhập câu hỏi ở phía trên để bắt đầu.' : 'Mở thư viện bằng biểu mẫu ở phía trên để tải PDF.'}</span>
          </div>
        </article>
      </div>
    </section>
  );
};
