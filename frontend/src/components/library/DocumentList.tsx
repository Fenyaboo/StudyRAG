import React from 'react';
import { FileText, Trash2, CheckCircle2, AlertTriangle, Layers, Clock, Database } from 'lucide-react';
import { apiService } from '../../services/api';

interface DocumentListProps {
  documents: any[];
  onRefresh: () => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({ documents, onRefresh }) => {
  const handleDelete = async (id: string, filename: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài liệu "${filename}" và toàn bộ đoạn vector đã lập chỉ mục không?`)) {
      return;
    }
    const res = await apiService.deleteDocument(id);
    if (res.success) {
      onRefresh();
    } else {
      alert(`Xóa thất bại: ${res.error}`);
    }
  };

  if (!documents || documents.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '3.5rem 2rem', textAlign: 'center', border: '1px solid rgba(141, 122, 255, 0.25)' }}>
        <Database size={48} color="var(--color-primary)" style={{ margin: '0 auto 1rem', opacity: 0.7 }} />
        <h3 style={{ fontSize: '1.25rem', color: 'var(--color-text)', margin: '0 0 0.5rem' }}>
          Thư Viện Tài Liệu Hiện Đang Trống
        </h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', maxWidth: '500px', margin: '0 auto' }}>
          Hãy kéo thả hoặc tải lên tài liệu PDF đề thi Toán, Lý, Hóa hoặc sách giáo khoa ở khu vực phía trên để hệ thống AI RAG bắt đầu học và ghi nhớ.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: '1.75rem', border: '1px solid rgba(141, 122, 255, 0.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={20} color="var(--color-accent)" />
          Danh Sách Tài Liệu Trong AI Repository ({documents.length})
        </h3>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--color-muted)', fontSize: '0.82rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '0.85rem 1rem' }}>Tên Tài Liệu</th>
              <th style={{ padding: '0.85rem 1rem' }}>Môn / Loại</th>
              <th style={{ padding: '0.85rem 1rem' }}>Quy Mô</th>
              <th style={{ padding: '0.85rem 1rem' }}>Trạng Thái</th>
              <th style={{ padding: '0.85rem 1rem' }}>Thời Gian</th>
              <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const isReady = doc.status === 'ready';
              const isOcr = doc.status === 'ocr_required';
              return (
                <tr
                  key={doc.id}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    transition: 'background 0.2s',
                    fontSize: '0.9rem'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(141, 122, 255, 0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <FileText size={22} color={isReady ? 'var(--color-primary)' : 'var(--color-warning)'} />
                      <div>
                        <strong style={{ display: 'block', color: 'var(--color-text)', marginBottom: '0.15rem' }}>
                          {doc.title || doc.filename}
                        </strong>
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                          {doc.filename} • {(doc.file_size_bytes / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600,
                      background: 'rgba(141, 122, 255, 0.15)', color: 'var(--color-primary)', marginRight: '0.4rem'
                    }}>
                      {doc.subject || 'Chung'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                      {doc.doc_type === 'exam' ? '📝 Đề thi' : '📖 Sách'}
                    </span>
                  </td>

                  <td style={{ padding: '1rem' }}>
                    <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>
                      {doc.page_count} trang
                    </span>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--color-accent)' }}>
                      ⚡ {doc.chunk_count} đoạn vector
                    </span>
                  </td>

                  <td style={{ padding: '1rem' }}>
                    {isReady ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-success)', fontSize: '0.85rem', fontWeight: 600 }}>
                        <CheckCircle2 size={16} /> Sẵn sàng (Ready)
                      </span>
                    ) : isOcr ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-warning)', fontSize: '0.85rem', fontWeight: 600 }}>
                        <AlertTriangle size={16} /> Cần OCR
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
                        Lỗi: {doc.error_message || doc.status}
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '1rem', color: 'var(--color-muted)', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock size={14} />
                      {doc.created_at ? new Date(doc.created_at).toLocaleDateString('vi-VN') : 'Vừa xong'}
                    </div>
                  </td>

                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDelete(doc.id, doc.filename)}
                      title="Xóa tài liệu và vector"
                      style={{
                        padding: '0.45rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--color-danger)', cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
