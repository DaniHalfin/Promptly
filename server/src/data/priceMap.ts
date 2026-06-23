import snapshot from './snapshot/model_prices_and_context_window.json' with { type: 'json' };
import { SourceId } from '../types/index.js';

export interface PriceEntry {
  input_cost_per_token: number;
  output_cost_per_token: number;
  cache_creation_input_token_cost?: number;
  cache_read_input_token_cost?: number;
}

export type PriceMap = Map<string, PriceEntry>;

type RawPriceMap = Record<string, unknown>;

function isPriceEntry(value: unknown): value is PriceEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<PriceEntry>;
  return typeof entry.input_cost_per_token === 'number' && typeof entry.output_cost_per_token === 'number';
}

function toPriceMap(raw: unknown): PriceMap {
  if (!raw || typeof raw !== 'object') return new Map();

  const entries = Object.entries(raw as RawPriceMap).filter((entry): entry is [string, PriceEntry] =>
    isPriceEntry(entry[1])
  );
  return new Map(entries);
}

let cached: PriceMap | null = null;
let metadata: {
  loadedAt: string;
  source: 'github-fetch' | 'bundled-snapshot';
  modelCount: number;
  sourceDate?: string;
} | null = null;

export async function loadPriceMap(): Promise<PriceMap> {
  if (cached) return cached;

  const REMOTE =
    'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
  let source: 'github-fetch' | 'bundled-snapshot' = 'bundled-snapshot';
  let raw: unknown;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(REMOTE, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`status ${res.status}`);
    raw = await res.json();
    source = 'github-fetch';
  } catch {
    // Fallback to bundled snapshot
    raw = snapshot;
    source = 'bundled-snapshot';
  }

  cached = toPriceMap(raw);
  metadata = {
    loadedAt: new Date().toISOString(),
    source,
    modelCount: cached.size,
    sourceDate: new Date().toISOString().split('T')[0],
  };
  return cached;
}

export function getPriceMapMeta() {
  return metadata || { loadedAt: new Date().toISOString(), source: 'bundled-snapshot' as const, modelCount: 0 };
}

export function isModelCostEstimated(sourceId: SourceId): boolean {
  return sourceId === 'openai';
}

export function lookupPrice(map: PriceMap, model: string): PriceEntry | null {
  if (map.has(model)) return map.get(model)!;

  // Prefix matching: longest match wins
  let best: PriceEntry | null = null;
  let bestLen = 0;

  for (const key of map.keys()) {
    if (model.startsWith(key) && key.length > bestLen) {
      best = map.get(key)!;
      bestLen = key.length;
    }
    if (key.startsWith(model) && key.length > bestLen) {
      best = map.get(key)!;
      bestLen = key.length;
    }
  }

  return best;
}
