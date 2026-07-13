import { supabase } from './supabase';
import { DocumentRecord, HealthStatus, QueryResponse, ReadyStatus } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000/api/v1';

export class UnauthenticatedApiError extends Error {
  constructor() {
    super('Authentication required.');
    this.name = 'UnauthenticatedApiError';
  }
}

const unauthenticatedListeners = new Set<() => void>();

async function invalidateAuthentication() {
  unauthenticatedListeners.forEach((listener) => listener());
  await supabase?.auth.signOut({ scope: 'local' });
}

async function authHeaders(): Promise<HeadersInit> {
  if (!supabase) {
    await invalidateAuthentication();
    throw new UnauthenticatedApiError();
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    await invalidateAuthentication();
    throw new UnauthenticatedApiError();
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

async function handleUnauthorizedResponse(response: Response) {
  if (response.status !== 401) return;

  await invalidateAuthentication();
  throw new UnauthenticatedApiError();
}

export const apiService = {
  onUnauthenticated(listener: () => void) {
    unauthenticatedListeners.add(listener);
    return () => {
      unauthenticatedListeners.delete(listener);
    };
  },

  async getHealth(): Promise<{ data: HealthStatus | null; latencyMs: number; error?: string }> {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const res = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      const latencyMs = Math.round(performance.now() - start);
      if (!res.ok) {
        return { data: null, latencyMs, error: `HTTP status ${res.status}` };
      }
      const data: HealthStatus = await res.json();
      return { data, latencyMs };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      return { 
        data: null, 
        latencyMs, 
        error: err.name === 'AbortError' ? 'Timeout (5s)' : (err.message || 'Network disconnected') 
      };
    }
  },

  async getReady(): Promise<{ data: ReadyStatus | null; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${API_BASE_URL}/ready`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return { data: null, error: `HTTP status ${res.status}` };
      }
      const data: ReadyStatus = await res.json();
      return { data };
    } catch (err: any) {
      return { data: null, error: err.message || 'Network disconnected' };
    }
  },

  async ingestDocument(file: File, title?: string, subject?: string, docType?: string): Promise<{ data: any; error?: { code: string; message: string; details?: any } }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (title) formData.append('title', title);
      if (subject) formData.append('subject', subject);
      if (docType) formData.append('doc_type', docType);

      const res = await fetch(`${API_BASE_URL}/ingest`, {
        method: 'POST',
        body: formData,
        headers: await authHeaders(),
      });

      await handleUnauthorizedResponse(res);

      const json = await res.json();
      if (!res.ok) {
        return { data: null, error: json.error || { code: 'UPLOAD_FAILED', message: `HTTP status ${res.status}` } };
      }
      return { data: json };
    } catch (err: any) {
      if (err instanceof UnauthenticatedApiError) throw err;
      return { data: null, error: { code: 'NETWORK_ERROR', message: err.message || 'Lỗi kết nối tới máy chủ.' } };
    }
  },

  async getDocuments(): Promise<{ data: DocumentRecord[] | null; error?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/documents`, {
        headers: { 'Accept': 'application/json', ...await authHeaders() }
      });
      await handleUnauthorizedResponse(res);
      if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
      const data: DocumentRecord[] = await res.json();
      return { data };
    } catch (err: any) {
      if (err instanceof UnauthenticatedApiError) throw err;
      return { data: null, error: err.message };
    }
  },

  async deleteDocument(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${id}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      });
      await handleUnauthorizedResponse(res);
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
      return { success: true };
    } catch (err: any) {
      if (err instanceof UnauthenticatedApiError) throw err;
      return { success: false, error: err.message };
    }
  },

  async queryRag(query: string, documentId?: string): Promise<{ data: QueryResponse | null; error?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...await authHeaders(),
        },
        body: JSON.stringify({ query, document_id: documentId })
      });
      await handleUnauthorizedResponse(res);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        return { data: null, error: errData.detail || `HTTP ${res.status}` };
      }
      const data: QueryResponse = await res.json();
      return { data };
    } catch (err: any) {
      if (err instanceof UnauthenticatedApiError) throw err;
      return { data: null, error: err.message };
    }
  }
};
