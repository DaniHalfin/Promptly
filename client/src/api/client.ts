import { SourceId, AnalysisReport } from '../types/index.js';

class APIClient {
  private baseURL = import.meta.env.VITE_API_URL ?? '/api';
  private headers: Record<string, string> = {};

  setCredential(sourceId: SourceId, credential: string) {
    // Map sourceId to the correct credential header name
    let headerName: string;
    if (sourceId === 'openai') headerName = 'x-credential-openai';
    else if (sourceId === 'anthropic') headerName = 'x-credential-anthropic';
    else return; // File uploads don't need credential headers
    
    this.headers[headerName] = credential;
  }

  clearCredentials() {
    this.headers = {};
  }

  async health() {
    return fetch(`${this.baseURL}/health`).then(r => r.json());
  }

  async priceMapMeta() {
    return fetch(`${this.baseURL}/price-map/meta`).then(r => r.json());
  }

  async validate(sourceId: SourceId, startDate?: string, endDate?: string) {
    const response = await fetch(`${this.baseURL}/sources/${sourceId}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: JSON.stringify({ startDate, endDate }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.errorMessage || `Validation failed: ${response.statusText}`);
    }
    if (result.valid === false) {
      throw new Error(result.errorMessage || 'Validation failed');
    }
    return result;
  }

  async analyze(config: any, credentials: Record<string, any>, files: Record<string, File | undefined>, signal?: AbortSignal) {
    // Clear stale credentials from previous analyses
    this.clearCredentials();

    const formData = new FormData();
    formData.append('config', JSON.stringify(config));

    Object.entries(credentials).forEach(([key, val]) => {
      if (val) this.setCredential(key as SourceId, val);
    });

    Object.entries(files).forEach(([key, file]) => {
      if (file) formData.append(key, file);
    });

    const response = await fetch(`${this.baseURL}/analyze`, {
      method: 'POST',
      headers: this.headers,
      body: formData,
      signal, // pass AbortSignal through to fetch
    });

    if (!response.ok) throw new Error(`Analysis failed: ${response.statusText}`);
    return response.json() as Promise<AnalysisReport>;
  }
}

export const apiClient = new APIClient();
