import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2, Sparkles, XCircle } from 'lucide-react';
import { apiService } from '../../services/api';

interface UploadDropzoneProps {
  onSuccess: () => void;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({ onSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Toán học');
  const [docType, setDocType] = useState('exam');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error' | 'ocr_required'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selected = e.dataTransfer.files[0];
      if (selected.type === 'application/pdf' || selected.name.toLowerCase().endsWith('.pdf')) {
        setFile(selected);
        if (!title) setTitle(selected.name.replace(/\.pdf$/i, ''));
        setStatus('idle');
        setErrorMessage(null);
      } else {
        setStatus('error');
        setErrorMessage('Vui lòng chỉ chọn định dạng tài liệu PDF.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!title) setTitle(selected.name.replace(/\.pdf$/i, ''));
      setStatus('idle');
      setErrorMessage(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus('uploading');
    setProgressMsg('Đang tải file PDF lên máy chủ và bóc tách từng trang (PyMuPDF)...');

    const result = await apiService.ingestDocument(file, title || file.name, subject, docType);

    if (result.error) {
      if (result.error.code === 'OCR_REQUIRED') {
        setStatus('ocr_required');
        setErrorMessage(result.error.message);
        setErrorDetails(result.error.details);
      } else {
        setStatus('error');
        setErrorMessage(result.error.message || 'Có lỗi xảy ra khi xử lý tài liệu.');
      }
    } else {
      setStatus('success');
      setProgressMsg(result.data.message || 'Xử lý và lập chỉ mục thành công!');
      setTimeout(() => {
        setFile(null);
        setTitle('');
        setStatus('idle');
        onSuccess();
      }, 2500);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', border: '1px solid rgba(141, 122, 255, 0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '10px',
          background: 'rgba(141, 122, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <UploadCloud size={20} color="var(--color-primary)" />
        </div>
        <div>
          <h3 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--color-text)' }}>
            Nạp Tài Liệu Vào AI Studio Repository (Milestone 1)
          </h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            Tự động bóc tách trang PDF, cắt đoạn theo câu hỏi đề thi Toán/Lý/Hóa và lưu trữ vào Supabase pgvector
          </span>
        </div>
      </div>

      <form onSubmit={handleUpload}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.4rem' }}>
              Tên tài liệu / Tiêu đề
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Đề thi thử THPT Quốc Gia môn Toán 2026..."
              style={{
                width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px',
                background: 'rgba(6, 8, 20, 0.6)', border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'var(--color-text)', fontSize: '0.9rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.4rem' }}>
              Môn học
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{
                width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px',
                background: 'rgba(6, 8, 20, 0.6)', border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'var(--color-text)', fontSize: '0.9rem'
              }}
            >
              <option value="Toán học">📐 Toán học</option>
              <option value="Vật lý">⚡ Vật lý</option>
              <option value="Hóa học">🧪 Hóa học</option>
              <option value="Chung">🌐 Chuyên đề Chung</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.4rem' }}>
              Loại tài liệu
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              style={{
                width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px',
                background: 'rgba(6, 8, 20, 0.6)', border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'var(--color-text)', fontSize: '0.9rem'
              }}
            >
              <option value="exam">📝 Đề thi (Cắt theo Câu 1:, Bài 2:...)</option>
              <option value="textbook">📖 Sách / Chuyên đề (Cắt theo tiêu đề)</option>
            </select>
          </div>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? 'var(--color-accent)' : file ? 'var(--color-success)' : 'rgba(141, 122, 255, 0.5)'}`,
            borderRadius: '16px',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'rgba(247, 197, 107, 0.08)' : file ? 'rgba(16, 185, 129, 0.05)' : 'rgba(141, 122, 255, 0.05)',
            transition: 'all 0.3s ease',
            marginBottom: '1.5rem'
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,application/pdf"
            style={{ display: 'none' }}
          />
          {file ? (
            <div>
              <FileText size={42} color="var(--color-success)" style={{ margin: '0 auto 0.75rem' }} />
              <h4 style={{ fontSize: '1.1rem', margin: '0 0 0.35rem', color: 'var(--color-success)' }}>
                {file.name}
              </h4>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                Dung lượng: {(file.size / (1024 * 1024)).toFixed(2)} MB • Nhấn để chọn file khác
              </span>
            </div>
          ) : (
            <div>
              <UploadCloud size={46} color={isDragging ? 'var(--color-accent)' : 'var(--color-primary)'} style={{ margin: '0 auto 0.75rem', animation: 'pulseGlow 3s infinite' }} />
              <h4 style={{ fontSize: '1.1rem', margin: '0 0 0.4rem', color: 'var(--color-text)' }}>
                Kéo thả file PDF vào khu vực này hoặc <span style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>chọn từ máy tính</span>
              </h4>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>
                Hỗ trợ PDF đề thi Toán, Lý, Hóa (Tối đa 25MB) • Tự động bóc tách và phân đoạn thông minh
              </span>
            </div>
          )}
        </div>

        {/* Processing State & Error Displays */}
        {status === 'uploading' && (
          <div style={{
            padding: '1rem 1.25rem', borderRadius: '12px', background: 'rgba(141, 122, 255, 0.15)',
            border: '1px solid var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem'
          }}>
            <Loader2 size={20} className="spin" color="var(--color-primary)" />
            <span style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>{progressMsg}</span>
          </div>
        )}

        {status === 'success' && (
          <div style={{
            padding: '1rem 1.25rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem'
          }}>
            <CheckCircle2 size={20} color="var(--color-success)" />
            <span style={{ fontSize: '0.9rem', color: '#fff' }}>{progressMsg}</span>
          </div>
        )}

        {status === 'ocr_required' && (
          <div style={{
            padding: '1.25rem', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid var(--color-warning)', marginBottom: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <AlertTriangle size={20} color="var(--color-warning)" />
              <strong style={{ color: 'var(--color-warning)' }}>Yêu cầu OCR (Tài liệu dạng ảnh scan)</strong>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-text)', margin: 0 }}>
              {errorMessage}
            </p>
            {errorDetails && (
              <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '6px' }}>
                Chi tiết trang quét: {JSON.stringify(errorDetails)}
              </div>
            )}
          </div>
        )}

        {status === 'error' && (
          <div style={{
            padding: '1rem 1.25rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem'
          }}>
            <XCircle size={20} color="var(--color-danger)" />
            <span style={{ fontSize: '0.9rem', color: '#fff' }}>{errorMessage}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          {file && (
            <button
              type="button"
              onClick={() => { setFile(null); setStatus('idle'); }}
              style={{
                padding: '0.65rem 1.25rem', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.08)',
                border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '0.9rem'
              }}
            >
              Hủy
            </button>
          )}
          <button
            type="submit"
            disabled={!file || status === 'uploading'}
            style={{
              padding: '0.75rem 1.75rem', borderRadius: '12px',
              background: !file || status === 'uploading' ? 'rgba(141, 122, 255, 0.3)' : 'linear-gradient(135deg, var(--color-primary), #6366f1)',
              border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontWeight: 600,
              cursor: !file || status === 'uploading' ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              boxShadow: !file || status === 'uploading' ? 'none' : '0 4px 18px rgba(141, 122, 255, 0.4)'
            }}
          >
            {status === 'uploading' ? (
              <>
                <Loader2 size={18} className="spin" /> Đang Xử Lý & Lập Chỉ Mục...
              </>
            ) : (
              <>
                <Sparkles size={18} color="var(--color-accent)" /> Bắt Đầu Phân Tích & Nạp PDF
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
