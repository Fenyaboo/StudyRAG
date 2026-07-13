import type { DocumentRecord } from '../../types';
import { DocumentList } from './DocumentList';
import { UploadDropzone } from './UploadDropzone';
import '../../styles/library.css';

interface LibraryPageProps {
  documents: DocumentRecord[];
  onDocumentsChanged: () => void;
}

export const LibraryPage = ({ documents, onDocumentsChanged }: LibraryPageProps) => (
  <section className="library-workspace" aria-labelledby="library-title">
    <header className="library-workspace__intro">
      <span>Thư viện riêng tư</span>
      <h1 id="library-title">Tài liệu cho phiên học của bạn</h1>
      <p>PDF được lưu trong không gian riêng và chỉ dùng làm nguồn trả lời cho StudyRAG của bạn.</p>
    </header>

    <UploadDropzone onSuccess={onDocumentsChanged} />
    <DocumentList documents={documents} onDocumentsChanged={onDocumentsChanged} />
  </section>
);
