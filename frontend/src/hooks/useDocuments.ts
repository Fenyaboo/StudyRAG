import { useCallback, useEffect, useState } from "react";
import { api, type Document, type DocumentStats, type DocumentType, type Subject } from "../lib/api";

export function useDocuments(filters: { subject?: string; status?: string; search?: string } = {}) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<DocumentStats>({ total: 0, ready: 0, stored: 0, processing: 0, failed: 0, ocr_required: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, nextStats] = await Promise.all([api.listDocuments(filters), api.getDocumentStats()]);
      setDocuments(list.items);
      setStats(nextStats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải thư viện");
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.status, filters.subject]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const upload = async (file: File, subject: Subject, docType: DocumentType) => {
    const result = await api.uploadDocument(file, subject, docType);
    await refresh();
    return result;
  };

  const remove = async (id: string) => {
    await api.deleteDocument(id);
    await refresh();
  };

  return { documents, stats, loading, error, refresh, upload, remove };
}
