import snapshot from './snapshot/model_prices_and_context_window.json' with { type: 'json' };
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SNAPSHOT_META_PATH = join(__dirname, 'snapshot', 'snapshot-meta.json');
const REMOTE =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const REVALIDATION_INTERVAL_MS = 24 * 60 * 60 * 1000;

let cached: PriceMap | null = null;
let revalidationTimer: ReturnType<typeof setInterval> | null = null;
let metadata: {
  loadedAt: string;
  source: 'github-fetch' | 'bundled-snapshot';
  modelCount: number;
  sourceDate?: string;
  lastRevalidatedAt?: string;
  snapshotAgeDays: number | null;
} | null = null;

async function readSnapshotAgeDays(): Promise<number | null> {
  try {
    const raw = await readFile(SNAPSHOT_META_PATH, 'utf-8');
    const meta = JSON.parse(raw) as { fetchedAt: string; modelCount: number };
    const ageMsec = Date.now() - new Date(meta.fetchedAt).getTime();
    return Math.floor(ageMsec / (24 * 60 * 60 * 1000));
  } catch {
    return null;
  }
}

function scheduleBackgroundRevalidation(): void {
  revalidationTimer = setInterval(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch(REMOTE, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const raw = await res.json();
      cached = toPriceMap(raw);
      if (metadata) {
        metadata.modelCount = cached.size;
        metadata.lastRevalidatedAt = new Date().toISOString();
      }
    } catch {
      // Keep existing cache on transient failure
    }
  }, REVALIDATION_INTERVAL_MS);
  revalidationTimer.unref?.();
}

export async function loadPriceMap(): Promise<PriceMap> {
  if (cached) return cached;

  let source: 'github-fetch' | 'bundled-snapshot' = 'bundled-snapshot';
  let raw: unknown;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(REMOTE, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`status ${res.status}`);
    raw = await res.json();
    source = 'github-fetch';
  } catch {
    raw = snapshot;
    source = 'bundled-snapshot';
  }

  cached = toPriceMap(raw);
  const snapshotAgeDays = await readSnapshotAgeDays();

  metadata = {
    loadedAt: new Date().toISOString(),
    source,
    modelCount: cached.size,
    sourceDate: new Date().toISOString().split('T')[0],
    snapshotAgeDays,
  };

  if (source === 'github-fetch') {
    scheduleBackgroundRevalidation();
  }

  return cached;
}

export function getPriceMapMeta() {
  return metadata ?? {
    loadedAt: new Date().toISOString(),
    source: 'bundled-snapshot' as const,
    modelCount: 0,
    snapshotAgeDays: null as number | null,
    sourceDate: undefined,
    lastRevalidatedAt: undefined,
  };
}

export function stopBackgroundRevalidation(): void {
  if (revalidationTimer !== null) {
    clearInterval(revalidationTimer);
    revalidationTimer = null;
  }
}

export function resetForTesting(): void {
  cached = null;
  metadata = null;
  if (revalidationTimer !== null) {
    clearInterval(revalidationTimer);
    revalidationTimer = null;
  }
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

