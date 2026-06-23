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
