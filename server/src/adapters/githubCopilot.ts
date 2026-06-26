import { createReadStream } from 'node:fs';
import { opendir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { SourceAdapter, AdapterContext, AdapterResult } from './types.js';
import { NormalizedCopilotSession, NormalizedSourceData } from '../types/index.js';

const SOURCE_ID = 'github_copilot' as const;
const DEFAULT_DAYS = 30;

// Root directory for GitHub Copilot session state data.
// Uses os.homedir() — never literal ~/ or process.env.HOME — for cross-platform safety.
function getSessionStateRoot(): string {
  return path.join(os.homedir(), '.copilot', 'session-state');
}

async function directoryExists(dir: string): Promise<boolean> {
  try {
    const info = await stat(dir);
    return info.isDirectory();
  } catch {
    return false;
  }
}

/** Converts a Unix-ms timestamp to YYYY-MM-DD in the local system timezone. */
function localDateString(unixMs: number): string {
  return new Date(unixMs).toLocaleDateString('en-CA', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Shape of a session.shutdown event in events.jsonl.
 *
 * Token semantics (critical):
 *   - inputTokens  = TOTAL prompt tokens.  cacheReadTokens + cacheWriteTokens are SUBSETS, NOT additive.
 *   - outputTokens = TOTAL completion tokens. reasoningTokens is a SUBSET, NOT additive.
 *   - requests.cost is a USD float (AI credit units), NOT a request count integer.
 */
export interface ShutdownEvent {
  type: 'session.shutdown';
  sessionStartTime: number; // Unix ms
  modelMetrics?: Record<string, {
    requests?: {
      count?: number;
      cost?: number; // USD float (AI credit units)
    };
    usage?: {
      inputTokens?: number;      // TOTAL; cacheReadTokens/cacheWriteTokens are subsets
      outputTokens?: number;     // TOTAL; reasoningTokens is a subset
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
      reasoningTokens?: number;
    };
  }>;
  totalPremiumRequests?: number; // float AI credit cost — cross-check only
}

/** Stream-parse a single events.jsonl file, returning only session.shutdown events. */
async function parseEventsFile(filePath: string): Promise<ShutdownEvent[]> {
  const events: ShutdownEvent[] = [];
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

    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      (parsed as Record<string, unknown>)['type'] !== 'session.shutdown'
    ) {
      continue;
    }

    events.push(parsed as ShutdownEvent);
  }

  return events;
}

/** Map a ShutdownEvent to a NormalizedCopilotSession. */
export function normalizeSession(event: ShutdownEvent, sourceFile: string): NormalizedCopilotSession {
  const date = localDateString(event.sessionStartTime);
  const models: NormalizedCopilotSession['models'] = {};

  for (const [modelName, metrics] of Object.entries(event.modelMetrics ?? {})) {
    // requestCost: USD float (AI credit units) — not a request count
    const requestCost = asNumber(metrics.requests?.cost);
    // inputTokens = TOTAL prompt tokens; cacheReadTokens + cacheWriteTokens are subsets, NOT additive
    const inputTokens = asNumber(metrics.usage?.inputTokens);
    // outputTokens = TOTAL completion tokens; reasoningTokens is a subset, NOT additive
    const outputTokens = asNumber(metrics.usage?.outputTokens);

    models[modelName] = {
      requestCount: asNumber(metrics.requests?.count),
      requestCost,
      inputTokens,
      outputTokens,
      cacheReadTokens: asNumber(metrics.usage?.cacheReadTokens),
      cacheWriteTokens: asNumber(metrics.usage?.cacheWriteTokens),
      reasoningTokens: asNumber(metrics.usage?.reasoningTokens),
    };
  }

  return { date, sourceFile, models, totalCost: event.totalPremiumRequests ?? 0 };
}

const githubCopilotAdapter: SourceAdapter = {
  id: SOURCE_ID,

  async validate() {
    const root = getSessionStateRoot();
    if (!await directoryExists(root)) {
      return {
        valid: false,
        error: {
          code: 'NOT_FOUND',
          message: 'No Copilot session data found. Have you run GitHub Copilot at least once?',
          retriable: false,
        },
      };
    }
    return { valid: true, error: null };
  },

  async run(ctx: AdapterContext): Promise<AdapterResult> {
    const warnings: string[] = [];

    try {
      const root = getSessionStateRoot();

      if (!await directoryExists(root)) {
        return {
          sourceId: SOURCE_ID,
          tier: null,
          connected: false,
          error: {
            code: 'NOT_FOUND',
            message: 'No Copilot session data found. Have you run GitHub Copilot at least once?',
            retriable: false,
          },
          raw: null,
          warnings,
        };
      }

      // Determine the analysis window (default: last 30 days in local timezone)
      const endDate = ctx.endDate ?? new Date();
      // TODO(DST): This arithmetic shifts by fixed-length hours and is not DST-aware.
      // date-fns/dayjs/luxon are not available in this package.
      // If DST skew causes users to miss 1 day at period boundaries,
      // add date-fns and replace with subDays(endDate, DEFAULT_DAYS - 1).
      const startDate = ctx.startDate ?? new Date(endDate.getTime() - (DEFAULT_DAYS - 1) * 24 * 60 * 60 * 1000);
      const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const startStr = startDate.toLocaleDateString('en-CA', { timeZone: localTz });
      const endStr = endDate.toLocaleDateString('en-CA', { timeZone: localTz });

      const copilotSessions: NormalizedCopilotSession[] = [];
      let hadMalformedFiles = false;
      let hadSubdirs = false;
      const seenSessionKeys = new Set<string>();
      let hadDuplicateEvents = false;

      // Read all immediate subdirectories under root; each may contain events.jsonl
      const rootDir = await opendir(root);
      for await (const entry of rootDir) {
        if (!entry.isDirectory()) continue;
        hadSubdirs = true;

        const eventsFilePath = path.join(root, entry.name, 'events.jsonl');

        // Check whether events.jsonl exists in this subdir
        try {
          const info = await stat(eventsFilePath);
          if (!info.isFile()) continue;
        } catch {
          continue; // No events.jsonl here
        }

        let events: ShutdownEvent[];
        try {
          events = await parseEventsFile(eventsFilePath);
        } catch {
          hadMalformedFiles = true;
          continue;
        }

        for (const event of events) {
          if (!Number.isFinite(event.sessionStartTime)) {
            hadMalformedFiles = true;
            continue;
          }

          const sessionDate = localDateString(event.sessionStartTime);
          // Filter to analysis window
          if (sessionDate < startStr || sessionDate > endStr) continue;

          // Deduplicate: crash/recovery cycles can write two session.shutdown events
          // with the same sessionStartTime to the same file.
          const sessionKey = `${eventsFilePath}:${event.sessionStartTime}`;
          if (seenSessionKeys.has(sessionKey)) {
            hadDuplicateEvents = true;
            continue;
          }
          seenSessionKeys.add(sessionKey);

          copilotSessions.push(normalizeSession(event, eventsFilePath));
        }
      }

      if (hadMalformedFiles) {
        warnings.push(
          'One or more Copilot session files could not be fully parsed. Sessions with malformed events are skipped; all valid session.shutdown events are still included.',
        );
      }

      if (hadDuplicateEvents) {
        warnings.push(
          'Duplicate session.shutdown events were detected and skipped. This can occur after a crash/recovery cycle; totals reflect deduplicated data.',
        );
      }

      if (copilotSessions.length === 0) {
        if (!hadSubdirs) {
          warnings.push(
            'No session subdirectories found — Copilot may not have generated sessions yet.',
          );
        } else {
          warnings.push(
            'No Copilot session data found for the selected period. Try a wider date range.',
          );
        }
      }

      // Derive period bounds from actual session dates (fall back to window bounds)
      const sessionDates = copilotSessions.map(s => s.date);
      const periodStart = sessionDates.length > 0
        ? sessionDates.reduce((a, b) => (a < b ? a : b))
        : startStr;
      const periodEnd = sessionDates.length > 0
        ? sessionDates.reduce((a, b) => (a > b ? a : b))
        : endStr;

      const raw: NormalizedSourceData = {
        sourceId: SOURCE_ID,
        copilotSessions,
        periodStart,
        periodEnd,
      };

      return {
        sourceId: SOURCE_ID,
        tier: copilotSessions.length > 0 ? 'B' : null,
        connected: true,
        error: null,
        raw,
        warnings,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        sourceId: SOURCE_ID,
        tier: null,
        connected: false,
        error: { code: 'FETCH_ERROR', message, retriable: true },
        raw: null,
        warnings,
      };
    }
  },
};

export default githubCopilotAdapter;
