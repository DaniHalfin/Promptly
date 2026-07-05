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

/**
 * Result of an adapter's validate() call.
 *
 * Discriminated union on `valid` so TypeScript enforces the contract:
 *   - valid: true  → `daysAvailable` is REQUIRED (a defined number) and `error` is null.
 *   - valid: false → `daysAvailable` MUST be absent and `error` carries the failure.
 *
 * This removes the `?? 0` footgun in the /validate route: a valid result can no
 * longer silently omit `daysAvailable`. A source with no usable data must report
 * `daysAvailable: 0` explicitly, which the route maps to availability: 'none'.
 */
export type AdapterValidateResult =
  | { valid: true; daysAvailable: number; error: null }
  | { valid: false; daysAvailable?: never; error: AdapterError };

export interface SourceAdapter {
  id: SourceId;
  validate(ctx: AdapterContext): Promise<AdapterValidateResult>;
  run(ctx: AdapterContext): Promise<AdapterResult>;
}
