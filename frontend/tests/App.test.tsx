import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { App } from '../src/app/App';

// Mock apiService
vi.mock('../src/services/api', () => ({
  apiService: {
    getHealth: vi.fn().mockResolvedValue({
      data: {
        status: 'ok',
        version: '2.0.0',
        environment: 'development',
        timestamp: '2026-07-12T16:30:00Z',
      },
      latencyMs: 15,
    }),
    getReady: vi.fn().mockResolvedValue({
      data: {
        status: 'ready',
        database: 'sqlite_ready',
        vector_store: 'chromadb_ready',
        embedding_provider: 'sentence_transformers',
        llm_provider: 'ollama',
        details: {},
      },
    }),
  },
}));

describe('App component', () => {
  it('renders StudyRAG V2 title and checks connection', async () => {
    render(<App />);
    
    expect(screen.getByRole('heading', { name: /StudyRAG V2/i })).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText(/API Live Monitoring/i)).toBeInTheDocument();
    });
  });
});
