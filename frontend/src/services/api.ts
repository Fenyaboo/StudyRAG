import { HealthStatus, ReadyStatus } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000/api/v1';

export const apiService = {
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
  }
};
