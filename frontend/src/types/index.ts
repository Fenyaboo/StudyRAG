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
