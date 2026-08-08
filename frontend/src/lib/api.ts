import { supabase } from "./supabase";

export type DocumentStatus = "processing" | "ready" | "failed" | "ocr_required";
export type Subject = "Toán" | "Lý" | "Hóa" | "Chung";
export type DocumentType = "exam" | "textbook";

export interface Document {
  id: string;
  title: string;
  filename: string;
  file_size_bytes: number;
  subject: Subject;
  doc_type: DocumentType;
  status: DocumentStatus;
  page_count: number;
  chunk_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentStats {
  total: number;
  ready: number;
  processing: number;
  failed: number;
  ocr_required: number;
}

export interface Citation {
  index: number;
  document_id: string;
  document_name: string;
  page: number | null;
  text: string;
  score: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  latency_ms: number | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  document_id: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

export interface ChatDone {
  answer: string;
  citations: Citation[];
  conversation_id: string;
  message_id: string;
  latency_ms: number;
}

export interface ChatRequest {
  query: string;
  document_id?: string | null;
  conversation_id?: string | null;
}

type ApiErrorPayload = { error?: { message?: string; code?: string }; detail?: string };

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:8000/api/v1";

async function authToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await authToken();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (response.status === 401) {
    await supabase.auth.signOut();
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(payload.error?.message || payload.detail || "Có lỗi xảy ra");
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  listDocuments: (params: { subject?: string; status?: string; search?: string } = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => value && query.set(key, value));
    return request<{ items: Document[]; total: number }>(`/documents${query.size ? `?${query}` : ""}`);
  },
  getDocumentStats: () => request<DocumentStats>("/documents/stats"),
  uploadDocument: async (file: File, subject: Subject, docType: DocumentType) => {
    const form = new FormData();
    form.append("file", file);
    form.append("subject", subject);
    form.append("doc_type", docType);
    return request<{ document: Document; accepted: boolean; message: string }>("/documents/ingest", {
      method: "POST",
      body: form,
    });
  },
  deleteDocument: (id: string) => request<void>(`/documents/${id}`, { method: "DELETE" }),
  getDocumentUrl: (id: string) => request<{ url: string; expires_in: number }>(`/documents/${id}/url`),
  listConversations: () => request<{ items: Conversation[]; total: number }>("/conversations"),
  listMessages: (conversationId: string) => request<{ items: Message[]; total: number }>(`/conversations/${conversationId}/messages`),
  renameConversation: (id: string, title: string) => request<Conversation>(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
  deleteConversation: (id: string) => request<void>(`/conversations/${id}`, { method: "DELETE" }),
  streamChat: async (
    payload: ChatRequest,
    handlers: {
      onToken: (content: string) => void;
      onDone: (data: ChatDone) => void;
      onError: (message: string) => void;
    },
  ) => {
    const token = await authToken();
    const headers = new Headers({ "Content-Type": "application/json", Accept: "text/event-stream" });
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${API_BASE_URL}/chat`, { method: "POST", headers, body: JSON.stringify(payload) });
    if (!response.ok || !response.body) {
      const body = (await response.json().catch(() => ({}))) as ApiErrorPayload;
      throw new Error(body.error?.message || body.detail || "Không thể kết nối AI");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() || "";
      for (const frame of frames) {
        let event = "message";
        let data = "";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        try {
          const parsed = JSON.parse(data) as { content?: string; message?: string } & ChatDone;
          if (event === "token" && parsed.content) handlers.onToken(parsed.content);
          else if (event === "done") handlers.onDone(parsed as ChatDone);
          else if (event === "error") handlers.onError(parsed.message || "Không thể hoàn tất câu trả lời");
        } catch {
          handlers.onError("Dữ liệu streaming không hợp lệ");
        }
      }
      if (done) break;
    }
  },
};
