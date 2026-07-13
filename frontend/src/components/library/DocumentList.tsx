import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Database, FileText, Layers, Trash2, X } from 'lucide-react';
import { UnauthenticatedApiError, apiService } from '../../services/api';
import type { DocumentRecord } from '../../types';

interface DocumentListProps {
  documents: DocumentRecord[];
  onDocumentsChanged: () => void;
}

const statusContent = (document: DocumentRecord) => {
  if (document.status === 'ready') return <span className="document-status document-status--ready"><CheckCircle2 size={15} /> Sẵn sàng</span>;
  if (document.status === 'ocr_required') return <span className="document-status document-status--warning"><AlertTriangle size={15} /> Cần OCR</span>;
  if (document.status === 'processing') return <span className="document-status document-status--processing">Đang xử lý</span>;
  return <span className="document-status document-status--error">{document.error_message || 'Không thể xử lý'}</span>;
};

export const DocumentList = ({ documents, onDocumentsChanged }: DocumentListProps) => {
  const [documentToDelete, setDocumentToDelete] = useState<DocumentRecord | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement | null>(null);

  const closeDeleteDialog = () => {
    setDocumentToDelete(null);
    openerRef.current?.focus();
  };

  useEffect(() => {
    if (documentToDelete) cancelButtonRef.current?.focus();
  }, [documentToDelete]);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDeleteDialog();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusableButtons = [closeButtonRef.current, cancelButtonRef.current, deleteButtonRef.current]
      .filter((button): button is HTMLButtonElement => Boolean(button && !button.disabled));
    const currentIndex = focusableButtons.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = currentIndex < 0
      ? 1
      : (currentIndex + (event.shiftKey ? -1 : 1) + focusableButtons.length) % focusableButtons.length;

    event.preventDefault();
    focusableButtons[nextIndex]?.focus();
  };

  const confirmDelete = async () => {
    if (!documentToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const result = await apiService.deleteDocument(documentToDelete.id);
      if (!result.success) {
        setDeleteError(result.error || 'Không thể xóa tài liệu.');
        return;
      }
      closeDeleteDialog();
      onDocumentsChanged();
    } catch (error) {
      if (error instanceof UnauthenticatedApiError) return;
      setDeleteError('Không thể kết nối tới máy chủ. Hãy thử lại.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!documents.length) {
    return (
      <section className="library-empty-state" aria-labelledby="empty-library-title">
        <span className="library-empty-state__icon" aria-hidden="true"><Database size={34} /></span>
        <h2 id="empty-library-title">Thư viện của bạn đang trống</h2>
        <p>Tải PDF đầu tiên để StudyRAG có nguồn riêng, rõ ràng và có thể kiểm chứng khi trả lời.</p>
      </section>
    );
  }

  return (
    <section className="document-library" aria-labelledby="document-library-title">
      <div className="document-library__header">
        <div>
          <span>Kho tài liệu riêng</span>
          <h2 id="document-library-title"><Layers size={20} aria-hidden="true" /> {documents.length} tài liệu</h2>
        </div>
      </div>
      <div className="document-library__table-wrap">
        <table>
          <thead><tr><th>Tài liệu</th><th>Môn học</th><th>Quy mô</th><th>Trạng thái</th><th>Thời gian</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td data-label="Tài liệu"><div className="document-name"><FileText size={21} aria-hidden="true" /><div><strong>{document.title || document.filename}</strong><span>{document.filename}{document.file_size_bytes ? ` · ${(document.file_size_bytes / (1024 * 1024)).toFixed(2)} MB` : ''}</span></div></div></td>
                <td data-label="Môn học"><span className="document-subject">{document.subject || 'Chung'}</span><small>{document.doc_type === 'exam' ? 'Đề thi' : 'Sách / chuyên đề'}</small></td>
                <td data-label="Quy mô"><strong>{document.page_count ?? 0} trang</strong><small>{document.chunk_count ?? 0} đoạn</small></td>
                <td data-label="Trạng thái">{statusContent(document)}</td>
                <td data-label="Thời gian"><span className="document-date"><Clock size={14} aria-hidden="true" />{document.created_at ? new Date(document.created_at).toLocaleDateString('vi-VN') : 'Vừa xong'}</span></td>
                <td className="document-library__actions"><button type="button" className="document-delete" aria-label={`Xóa ${document.title || document.filename}`} onClick={(event) => { openerRef.current = event.currentTarget; setDocumentToDelete(document); }}><Trash2 size={16} aria-hidden="true" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {documentToDelete && (
        <div className="delete-dialog-backdrop" role="presentation">
          <div className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description" onKeyDown={handleDialogKeyDown}>
            <button ref={closeButtonRef} className="delete-dialog__close" type="button" aria-label="Đóng xác nhận xóa" onClick={closeDeleteDialog}><X size={18} /></button>
            <Trash2 size={22} aria-hidden="true" />
            <h3 id="delete-dialog-title">Xóa tài liệu này?</h3>
            <p id="delete-dialog-description">“{documentToDelete.title || documentToDelete.filename}” và toàn bộ đoạn đã lập chỉ mục sẽ bị xóa khỏi thư viện riêng của bạn.</p>
            {deleteError && <p className="delete-dialog__error" role="alert">{deleteError}</p>}
            <div><button ref={cancelButtonRef} className="library-button library-button--secondary" type="button" disabled={isDeleting} onClick={closeDeleteDialog}>Giữ lại</button><button ref={deleteButtonRef} className="library-button library-button--danger" type="button" disabled={isDeleting} onClick={() => void confirmDelete()}>{isDeleting ? 'Đang xóa…' : 'Xóa tài liệu'}</button></div>
          </div>
        </div>
      )}
    </section>
  );
};
