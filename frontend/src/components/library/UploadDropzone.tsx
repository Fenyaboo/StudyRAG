import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Loader2, Sparkles, UploadCloud, XCircle } from 'lucide-react';
import { UnauthenticatedApiError, apiService } from '../../services/api';

interface UploadDropzoneProps {
  onSuccess: () => void;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error' | 'ocr_required' | 'duplicate';

const isPdf = (selected: File) => selected.type === 'application/pdf' || selected.name.toLowerCase().endsWith('.pdf');

export const UploadDropzone = ({ onSuccess }: UploadDropzoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Toán học');
  const [docType, setDocType] = useState('exam');
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [message, setMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectFile = (selected: File) => {
    if (!isPdf(selected)) {
      setStatus('error');
      setMessage('Vui lòng chỉ chọn tài liệu PDF.');
      return;
    }

    setFile(selected);
    setTitle((currentTitle) => currentTitle || selected.name.replace(/\.pdf$/i, ''));
    setStatus('idle');
    setMessage('');
    setErrorDetails(null);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) selectFile(selected);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const selected = event.dataTransfer.files?.[0];
    if (selected) selectFile(selected);
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;

    setStatus('uploading');
    setMessage('Đang tải PDF lên và lập chỉ mục từng trang…');

    try {
      const result = await apiService.ingestDocument(file, title || file.name, subject, docType);
      if (result.error) {
        setMessage(result.error.message || 'Có lỗi xảy ra khi xử lý tài liệu.');
        setErrorDetails(result.error.details ?? null);
        setStatus(result.error.code === 'OCR_REQUIRED' ? 'ocr_required' : result.error.code === 'DUPLICATE_DOCUMENT' || result.error.code === 'DUPLICATE' ? 'duplicate' : 'error');
        return;
      }

      setStatus('success');
      setMessage(result.data?.message || 'Tài liệu đã sẵn sàng để StudyRAG tra cứu.');
      setFile(null);
      setTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      onSuccess();
    } catch (error) {
      if (error instanceof UnauthenticatedApiError) return;
      setStatus('error');
      setMessage('Không thể kết nối tới máy chủ. Hãy thử lại sau.');
    }
  };

  const clearSelection = () => {
    setFile(null);
    setStatus('idle');
    setMessage('');
    setErrorDetails(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <section className="library-upload" aria-labelledby="upload-title">
      <div className="library-upload__heading">
        <div className="library-upload__icon" aria-hidden="true"><UploadCloud size={21} /></div>
        <div>
          <h2 id="upload-title">Thêm PDF vào thư viện</h2>
          <p>StudyRAG sẽ đọc nội dung và chỉ dùng tài liệu này trong không gian riêng của bạn.</p>
        </div>
        <button className="library-upload__trigger" type="button" onClick={() => fileInputRef.current?.click()}>
          <UploadCloud size={16} aria-hidden="true" /> Tải tài liệu lên
        </button>
      </div>

      <form onSubmit={handleUpload}>
        <div className="library-upload__fields">
          <label>
            <span>Tiêu đề tài liệu</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Đề thi thử THPT môn Toán" />
          </label>
          <label>
            <span>Môn học</span>
            <select value={subject} onChange={(event) => setSubject(event.target.value)}>
              <option value="Toán học">Toán học</option>
              <option value="Vật lý">Vật lý</option>
              <option value="Hóa học">Hóa học</option>
              <option value="Chung">Chuyên đề chung</option>
            </select>
          </label>
          <label>
            <span>Loại tài liệu</span>
            <select value={docType} onChange={(event) => setDocType(event.target.value)}>
              <option value="exam">Đề thi</option>
              <option value="textbook">Sách hoặc chuyên đề</option>
            </select>
          </label>
        </div>

        <div
          className={`library-dropzone${isDragging ? ' is-dragging' : ''}${file ? ' has-file' : ''}`}
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input ref={fileInputRef} className="sr-only" type="file" accept=".pdf,application/pdf" onChange={handleFileChange} />
          {file ? (
            <>
              <FileText size={38} aria-hidden="true" />
              <strong>{file.name}</strong>
              <span>{(file.size / (1024 * 1024)).toFixed(2)} MB · sẵn sàng để tải lên</span>
            </>
          ) : (
            <>
              <UploadCloud size={42} aria-hidden="true" />
              <strong>Kéo PDF vào đây</strong>
              <span>hoặc dùng nút “Tải tài liệu lên” để chọn từ máy tính</span>
            </>
          )}
        </div>

        {status !== 'idle' && (
          <div className={`library-upload__status library-upload__status--${status}`} role={status === 'error' ? 'alert' : 'status'}>
            {status === 'uploading' && <Loader2 className="spin" size={20} aria-hidden="true" />}
            {status === 'success' && <CheckCircle2 size={20} aria-hidden="true" />}
            {status === 'ocr_required' && <AlertTriangle size={20} aria-hidden="true" />}
            {(status === 'error' || status === 'duplicate') && <XCircle size={20} aria-hidden="true" />}
            <div>
              <strong>{status === 'ocr_required' ? 'Tài liệu cần OCR' : status === 'duplicate' ? 'Tài liệu đã có trong thư viện' : status === 'success' ? 'Đã sẵn sàng' : status === 'uploading' ? 'Đang xử lý' : 'Không thể tải tài liệu'}</strong>
              <span>{message}</span>
              {status === 'ocr_required' && errorDetails !== null && <small>Chi tiết: {JSON.stringify(errorDetails)}</small>}
            </div>
          </div>
        )}

        <div className="library-upload__actions">
          {file && <button className="library-button library-button--secondary" type="button" onClick={clearSelection}>Bỏ chọn</button>}
          <button className="library-button library-button--primary" type="submit" disabled={!file || status === 'uploading'}>
            {status === 'uploading' ? <Loader2 className="spin" size={17} aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}
            {status === 'uploading' ? 'Đang lập chỉ mục' : 'Lưu vào thư viện'}
          </button>
        </div>
      </form>
    </section>
  );
};
