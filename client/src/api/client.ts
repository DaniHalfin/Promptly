import { SourceId, AnalysisReport, SourceReport } from '../types/index.js';

export type ValidationAvailability = 'full' | 'partial' | 'none';

export interface ValidateSourceResult {
  valid: boolean;
  sourceId: SourceId;
  availability: ValidationAvailability;
  daysAvailable?: number;
  daysRequested?: number;
  warnings?: string[];
  errorCode?: string;
  errorMessage?: string;
}

/**
 * FIX-7: Normalizes error messages before they reach the UI.
 * - Strips multi-line content (stack traces are multi-line)
 * - Strips common stack-trace indicators
 * - Returns a safe user-facing string
 */
export function normalizeErrorMessage(raw: string | undefined | null): string {
  if (!raw) return 'An unknown error occurred.';
  // Stack traces and technical paths: detect "at " frames or multiple newlines
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    // Multi-line = likely a stack trace. Return only the first line, sanitized.
    const first = lines[0];
    // If first line looks like an Error constructor ("Error: ..."), strip the prefix
    return first.replace(/^Error:\s*/i, '') || 'An unexpected error occurred.';
  }
  // Single-line but contains stack-trace markers
  if (/\s+at\s+\S+\s+\(/.test(raw)) {
    return 'An unexpected error occurred.';
  }
  // Strip "Error: " prefix and any trailing file path fragments
  return raw
    .replace(/^Error:\s*/i, '')
    .replace(/\s*\([^)]*\.(ts|js|tsx):\d+\)$/, '')
    .trim()
    || 'An unexpected error occurred.';
}

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

  async validate(sourceId: SourceId, startDate?: string, endDate?: string): Promise<ValidateSourceResult> {
    const response = await fetch(`${this.baseURL}/sources/${sourceId}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: JSON.stringify({ startDate, endDate }),
    });
    const result = await response.json().catch(() => ({} as Record<string, unknown>));

    // Normalize availability from the server response. The server returns
    // `availability` directly; fall back to deriving it if an older/edge
    // response is received. Structured no-data responses (HTTP 400 with
    // valid:false) are returned, not thrown — only transport errors throw.
    const valid = result.valid === true;
    const daysAvailable = typeof result.daysAvailable === 'number' ? result.daysAvailable : undefined;
    const daysRequested = typeof result.daysRequested === 'number' ? result.daysRequested : undefined;

    let availability: ValidationAvailability;
    if (result.availability === 'full' || result.availability === 'partial' || result.availability === 'none') {
      availability = result.availability;
    } else if (!valid || (daysAvailable ?? 0) === 0) {
      availability = 'none';
    } else if (daysRequested !== undefined && (daysAvailable ?? 0) < daysRequested) {
      availability = 'partial';
    } else {
      availability = 'full';
    }

    // Throw only for unexpected transport/server failures (e.g. 5xx) where the
    // response body carries no structured validation contract.
    if (!response.ok && result.availability === undefined && result.valid === undefined) {
      throw new Error(normalizeErrorMessage(result.errorMessage || `Validation failed: ${response.statusText}`));
    }

    return {
      valid,
      sourceId,
      availability,
      daysAvailable,
      daysRequested,
      warnings: Array.isArray(result.warnings) ? result.warnings : undefined,
      errorCode: typeof result.errorCode === 'string' ? result.errorCode : undefined,
      errorMessage: typeof result.errorMessage === 'string' ? result.errorMessage : undefined,
    };
  }

  /** Per-source analysis call: POST /api/analyze/:sourceId */
  async analyzeSource(
    sourceId: SourceId,
    credential?: string,
    file?: File,
    startDate?: string,
    endDate?: string,
    signal?: AbortSignal,
  ): Promise<SourceReport> {
    const headers: Record<string, string> = {};
    if (sourceId === 'openai' && credential) headers['x-credential-openai'] = credential;
    if (sourceId === 'anthropic' && credential) headers['x-credential-anthropic'] = credential;

    const formData = new FormData();
    if (startDate) formData.append('startDate', startDate);
    if (endDate) formData.append('endDate', endDate);
    if (file) formData.append(sourceId, file);

    const response = await fetch(`${this.baseURL}/analyze/${sourceId}`, {
      method: 'POST',
      headers,
      body: formData,
      signal,
    });

    if (!response.ok) throw new Error(`Analysis failed for ${sourceId}: ${normalizeErrorMessage(response.statusText)}`);
    return response.json() as Promise<SourceReport>;
  }

  /** Combine settled source reports into a full AnalysisReport with recommendations */
  async analyzeRecommendations(sources: SourceReport[], signal?: AbortSignal): Promise<AnalysisReport> {
    const response = await fetch(`${this.baseURL}/analyze/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources }),
      signal,
    });

    if (!response.ok) throw new Error(`Recommendations failed: ${normalizeErrorMessage(response.statusText)}`);
    return response.json() as Promise<AnalysisReport>;
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
