export interface HealthStatus {
  status: string;
  version: string;
  environment: string;
  timestamp: string;
}

export interface ReadyStatus {
  status: string;
  database: string;
  vector_store: string;
  embedding_provider: string;
  llm_provider: string;
  details: Record<string, any>;
}

export type ConnectionState = 'checking' | 'online' | 'offline' | 'connected' | 'error';

export interface DocumentRecord {
  id: string;
  filename: string;
  title?: string;
  subject?: string;
  doc_type?: string;
  status?: string;
  page_count?: number;
  chunk_count?: number;
  file_size_bytes?: number;
  created_at?: string;
  error_message?: string;
}

export interface CitationItem {
  index: number;
  document_name: string;
  page: number;
  text: string;
  score: number;
}

export interface QueryResponse {
  answer: string;
  citations: CitationItem[];
  provider: string;
  model: string;
  latency_ms: number;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: CitationItem[];
  provider?: string;
  model?: string;
  latencyMs?: number;
  timestamp: string;
}
