import { createReadStream } from 'node:fs';
import { opendir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { SourceAdapter, AdapterContext, AdapterResult } from './types.js';
import { NormalizedSourceData, NormalizedUsageRecord } from '../types/index.js';
import { lookupPrice } from '../data/priceMap.js';

const SOURCE_ID = 'claude_code' as const;
const MAX_SESSION_FILES = 500;

interface SessionFile {
  path: string;
  mtimeMs: number;
}

interface TokenBucket {
  date: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

function getProjectsDir() {
  return process.env.CLAUDE_CONFIG_DIR
    ? path.join(process.env.CLAUDE_CONFIG_DIR, 'projects')
    : path.join(os.homedir(), '.claude', 'projects');
}

async function collectJsonlFiles(dir: string): Promise<SessionFile[]> {
  const files: SessionFile[] = [];

  async function walk(currentDir: string) {
    let entries;
    try {
      entries = await opendir(currentDir);
    } catch (err: any) {
      if (err.code === 'ENOENT') return;
      throw err;
    }
    for await (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        const info = await stat(fullPath);
        files.push({ path: fullPath, mtimeMs: info.mtimeMs });
      }
    }
  }

  await walk(dir);
  return files;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function validTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : value;
}

function dateFromTimestamp(timestamp: string) {
  return timestamp.slice(0, 10);
}

export function isPeakHour(isoTimestamp: string): boolean {
  const normalizedTimestamp = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T.*(?:Z|[+-][0-9]{2}:[0-9]{2})$/.test(isoTimestamp)
    ? isoTimestamp
    : `${isoTimestamp}Z`;
  const parsed = new Date(normalizedTimestamp);
  if (Number.isNaN(parsed.getTime())) return false;

  const day = parsed.getUTCDay();
  const hour = parsed.getUTCHours();

  return day >= 1 && day <= 5 && hour >= 8 && hour < 18;
}

function costForBucket(ctx: AdapterContext, bucket: TokenBucket): number | null {
  const price = lookupPrice(ctx.priceMap, bucket.model);
  if (!price) return null;

  return (
    (bucket.inputTokens * price.input_cost_per_token) +
    (bucket.outputTokens * price.output_cost_per_token) +
    (bucket.cacheCreationInputTokens * (price.cache_creation_input_token_cost ?? price.input_cost_per_token)) +
    (bucket.cacheReadInputTokens * (price.cache_read_input_token_cost ?? 0))
  );
}

async function parseSessionFile(filePath: string) {
  const buckets = new Map<string, TokenBucket>();
  let firstTimestamp: string | undefined;
  let minTimestampMs: number | undefined;
  let maxTimestampMs: number | undefined;

  const stream = createReadStream(filePath, { encoding: 'utf-8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }

    const record = asRecord(parsed);
    if (!record) continue;

    const timestamp = validTimestamp(record.timestamp);
    if (timestamp) {
      firstTimestamp ??= timestamp;
      const timestampMs = new Date(timestamp).getTime();
      minTimestampMs = minTimestampMs === undefined ? timestampMs : Math.min(minTimestampMs, timestampMs);
      maxTimestampMs = maxTimestampMs === undefined ? timestampMs : Math.max(maxTimestampMs, timestampMs);
    }

    const message = asRecord(record.message);
    const modelFromRecord = typeof record.model === 'string' && record.model.trim() !== '' ? record.model : null;
    const modelFromMessage = typeof message?.model === 'string' && message.model.trim() !== '' ? message.model : null;
    const model = modelFromRecord ?? modelFromMessage;
    const usage = asRecord(record.usage) ?? asRecord(message?.usage) ?? record;
    const inputTokens = asFiniteNumber(usage.input_tokens);
    const outputTokens = asFiniteNumber(usage.output_tokens);

    if (!model || !timestamp || inputTokens === undefined || outputTokens === undefined) {
      continue;
    }

    const date = dateFromTimestamp(timestamp);
    const key = `${date}\u0000${model}`;
    const bucket = buckets.get(key) ?? {
      date,
      model,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };

    bucket.inputTokens += inputTokens;
    bucket.outputTokens += outputTokens;
    bucket.cacheCreationInputTokens += asFiniteNumber(usage.cache_creation_input_tokens) ?? 0;
    bucket.cacheReadInputTokens += asFiniteNumber(usage.cache_read_input_tokens) ?? 0;
    buckets.set(key, bucket);
  }

  return {
    buckets: [...buckets.values()],
    firstTimestamp,
    minTimestampMs,
    maxTimestampMs,
  };
}

/**
 * Count the distinct calendar days (UTC date prefix of each record timestamp)
 * that contain at least one valid Claude Code session record under `base`.
 *
 * Used by validate() to report `daysAvailable` (data coverage). Mirrors the
 * date bucketing in parseSessionFile() but only collects distinct dates, so a
 * connected-but-empty projects dir yields 0 → route maps to 'none'.
 */
async function countAvailableDays(base: string): Promise<number> {
  const files = await collectJsonlFiles(base);
  const days = new Set<string>();

  for (const file of files.slice(0, MAX_SESSION_FILES)) {
    const stream = createReadStream(file.path, { encoding: 'utf-8' });
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }
      const record = asRecord(parsed);
      if (!record) continue;
      const timestamp = validTimestamp(record.timestamp);
      if (!timestamp) continue;
      days.add(dateFromTimestamp(timestamp));
    }
  }

  return days.size;
}

const claudeCodeAdapter: SourceAdapter = {
  id: SOURCE_ID,

  async validate() {
    const base = getProjectsDir();
    try {
      const info = await stat(base);
      if (!info.isDirectory()) throw new Error('not a directory');
    } catch {
      return {
        valid: false,
        error: {
          code: 'NOT_FOUND',
          message: 'No Claude Code data found. Have you run Claude Code at least once?',
          retriable: false,
        },
      };
    }
    // Report actual coverage: number of distinct days with session records.
    const daysAvailable = await countAvailableDays(base);
    return { valid: true, error: null, daysAvailable };
  },

  async run(ctx: AdapterContext): Promise<AdapterResult> {
    const warnings: string[] = [];

    try {
      const base = getProjectsDir();
      const allFiles = await collectJsonlFiles(base);
      if (allFiles.length === 0) {
        return {
          sourceId: SOURCE_ID,
          tier: null,
          connected: false,
          error: {
            code: 'NOT_FOUND',
            message: 'No Claude Code data found. Have you run Claude Code at least once?',
            retriable: false,
          },
          raw: null,
          warnings,
        };
      }

      const files = allFiles
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
        .slice(0, MAX_SESSION_FILES);

      if (allFiles.length > MAX_SESSION_FILES) {
        warnings.push(`Claude Code session file count capped at ${MAX_SESSION_FILES} of ${allFiles.length}; only the most recent files were parsed.`);
      }

      const tokenBuckets = new Map<string, TokenBucket>();
      const sessionFirstTimestamps: string[] = [];
      let minTimestampMs: number | undefined;
      let maxTimestampMs: number | undefined;
      let parsedCount = 0;

      for (const file of files) {
        let session: Awaited<ReturnType<typeof parseSessionFile>>;
        try {
          session = await parseSessionFile(file.path);
        } catch {
          warnings.push(`Session file ${path.relative(base, file.path)} could not be parsed — skipped.`);
          continue;
        }
        parsedCount += 1;
        if (session.firstTimestamp) {
          sessionFirstTimestamps.push(session.firstTimestamp);
        }
        if (session.minTimestampMs !== undefined) {
          minTimestampMs = minTimestampMs === undefined ? session.minTimestampMs : Math.min(minTimestampMs, session.minTimestampMs);
        }
        if (session.maxTimestampMs !== undefined) {
          maxTimestampMs = maxTimestampMs === undefined ? session.maxTimestampMs : Math.max(maxTimestampMs, session.maxTimestampMs);
        }

        for (const bucket of session.buckets) {
          const key = `${bucket.date}\u0000${bucket.model}`;
          const existing = tokenBuckets.get(key) ?? {
            date: bucket.date,
            model: bucket.model,
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
          };
          existing.inputTokens += bucket.inputTokens;
          existing.outputTokens += bucket.outputTokens;
          existing.cacheCreationInputTokens += bucket.cacheCreationInputTokens;
          existing.cacheReadInputTokens += bucket.cacheReadInputTokens;
          tokenBuckets.set(key, existing);
        }
      }

      const dailyTokensByModel: NormalizedUsageRecord[] = [...tokenBuckets.values()]
        .sort((a, b) => a.date.localeCompare(b.date) || a.model.localeCompare(b.model))
        .map(bucket => ({
          date: bucket.date,
          model: bucket.model,
          inputTokens: bucket.inputTokens,
          outputTokens: bucket.outputTokens,
          cacheCreationInputTokens: bucket.cacheCreationInputTokens,
          cacheReadInputTokens: bucket.cacheReadInputTokens,
        }));

      const dailyCostByDate = new Map<string, number>();
      const warnedModels = new Set<string>();
      for (const bucket of tokenBuckets.values()) {
        const costUsd = costForBucket(ctx, bucket);
        if (costUsd === null) {
          if (!warnedModels.has(bucket.model)) {
            warnings.push(`Price unavailable for model '${bucket.model}' — cost contribution omitted.`);
            warnedModels.add(bucket.model);
          }
          continue;
        }
        dailyCostByDate.set(bucket.date, (dailyCostByDate.get(bucket.date) ?? 0) + costUsd);
      }

      const dailyCostUsd = [...dailyCostByDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, costUsd]) => ({ date, costUsd }));

      const peakCount = sessionFirstTimestamps.filter(isPeakHour).length;
      const claudeCodePeakHourFraction =
        sessionFirstTimestamps.length > 0 ? peakCount / sessionFirstTimestamps.length : undefined;

      const fallbackPeriod = ctx.startDate?.toISOString() ?? new Date().toISOString();
      const periodStart = minTimestampMs !== undefined ? new Date(minTimestampMs).toISOString() : fallbackPeriod;
      const periodEnd = maxTimestampMs !== undefined ? new Date(maxTimestampMs).toISOString() : (ctx.endDate?.toISOString() ?? fallbackPeriod);

      const raw: NormalizedSourceData = {
        sourceId: SOURCE_ID,
        tier: 'B',
        dailyTokensByModel,
        dailyCostUsd,
        cachedTokensSupported: true,
        sessionCount: parsedCount,
        claudeCodePeakHourFraction,
        periodStart,
        periodEnd,
      } as NormalizedSourceData & { tier: 'B' };

      return {
        sourceId: SOURCE_ID,
        tier: 'B',
        connected: true,
        error: null,
        raw,
        warnings,
      };
    } catch (err: any) {
      return {
        sourceId: SOURCE_ID,
        tier: null,
        connected: false,
        error: { code: 'FETCH_ERROR', message: err.message, retriable: true },
        raw: null,
        warnings,
      };
    }
  },
};

export default claudeCodeAdapter;
