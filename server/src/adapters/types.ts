import { SourceId, NormalizedSourceData } from '../types/index.js';
import { PriceMap } from '../data/priceMap.js';

export interface AdapterError {
  code: string;
  message: string;
  retriable: boolean;
}

export interface AdapterResult {
  sourceId: SourceId;
  tier: 'A' | 'B' | 'C' | null;
  connected: boolean;
  error: AdapterError | null;
  raw: NormalizedSourceData | null;
  warnings: string[];
}

/** Nullable credential type — file-based adapters (chatgpt_export) accept null. */
export type AdapterCredentials = string | null;

/** Connection options passed to adapters (ED v2.0 §3.2/§3.3.4). */
export interface AdapterConnectOptions {
  startDate?: Date;
  endDate?: Date;
  uploadedFile?: Buffer | null;
  options?: Record<string, unknown>;
  priceMap: PriceMap;
  abortSignal?: AbortSignal;
}

export interface AdapterContext {
  credential?: string;
  startDate?: Date;
  endDate?: Date;
  fileBuffer?: Buffer;
  options?: Record<string, unknown>;
  priceMap: PriceMap;
  abortSignal?: AbortSignal;
}

export interface SourceAdapter {
  id: SourceId;
  validate(ctx: AdapterContext): Promise<{ valid: boolean; error: AdapterError | null; daysAvailable?: number }>;
  run(ctx: AdapterContext): Promise<AdapterResult>;
}
