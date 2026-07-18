import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import githubCopilotAdapter, { normalizeSession } from '../src/adapters/githubCopilot.js';
import type { ShutdownEvent } from '../src/adapters/githubCopilot.js';
import type { PriceMap } from '../src/data/priceMap.js';

let savedDir: string | undefined;
let tempDirs: string[] = [];

beforeEach(() => { savedDir = process.env.COPILOT_SESSION_STATE_DIR; });
afterEach(() => {
  if (savedDir === undefined) delete process.env.COPILOT_SESSION_STATE_DIR;
  else process.env.COPILOT_SESSION_STATE_DIR = savedDir;
  
  Promise.all(tempDirs.map(dir => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

describe('githubCopilot adapter', () => {
  describe('normalizeSession()', () => {
    // If this test fails, GitHub Copilot changed the JSONL field name — update ShutdownEvent interface
    it('maps cacheWriteTokens from ShutdownEvent usage to NormalizedCopilotSession', () => {
      const model = 'claude-opus-4-8';
      const event: ShutdownEvent = {
        type: 'session.shutdown',
        data: {
          sessionStartTime: new Date('2026-06-15T12:00:00Z').getTime(),
          modelMetrics: {
            [model]: {
              requests: { count: 1, cost: 1 },
              usage: {
                inputTokens: 500,
                outputTokens: 100,
                cacheReadTokens: 0,
                cacheWriteTokens: 150,
                reasoningTokens: 0,
              },
            },
          },
        },
      };

      const result = normalizeSession(event, 'test-events.jsonl');

      expect(result.models[model].cacheWriteTokens).toBe(150);
    });

    it('defaults cacheWriteTokens to 0 when field is absent', () => {
      const model = 'gpt-5.4-mini';
      const event: ShutdownEvent = {
        type: 'session.shutdown',
        data: {
          sessionStartTime: new Date('2026-06-15T12:00:00Z').getTime(),
          modelMetrics: {
            [model]: {
              requests: { count: 2, cost: 0.5 },
              usage: {
                inputTokens: 200,
                outputTokens: 80,
                // cacheWriteTokens intentionally omitted
              },
            },
          },
        },
      };

      const result = normalizeSession(event, 'test-events.jsonl');

      expect(result.models[model].cacheWriteTokens).toBe(0);
    });

    it('uses totalPremiumRequests as totalCost when modelMetrics is empty', () => {
      const event: ShutdownEvent = {
        type: 'session.shutdown',
        data: {
          sessionStartTime: new Date('2026-06-01T00:00:00Z').getTime(),
          modelMetrics: {},
          totalPremiumRequests: 42,
        },
      };
      const result = normalizeSession(event, 'test-events.jsonl');
      expect(result.totalCost).toBe(42);
      expect(Object.keys(result.models)).toHaveLength(0);
    });

    it('uses totalPremiumRequests even when modelMetrics is present', () => {
      // totalCost is the raw field, not a recomputed sum — design §3.5
      const event: ShutdownEvent = {
        type: 'session.shutdown',
        data: {
          sessionStartTime: new Date('2026-06-01T00:00:00Z').getTime(),
          modelMetrics: {
            'gpt-5.4': {
              requests: { count: 2, cost: 3 },
              usage: { inputTokens: 100, outputTokens: 40 },
            },
          },
          totalPremiumRequests: 15, // raw field disagrees — raw wins
        },
      };
      const result = normalizeSession(event, 'test-events.jsonl');
      expect(result.totalCost).toBe(15);
    });

    it('defaults totalCost to 0 when totalPremiumRequests is absent', () => {
      const event: ShutdownEvent = {
        type: 'session.shutdown',
        data: {
          sessionStartTime: new Date('2026-06-01T00:00:00Z').getTime(),
        },
      };
      const result = normalizeSession(event, 'test-events.jsonl');
      expect(result.totalCost).toBe(0);
    });
  });

  describe('run()', () => {
    it('returns NOT_FOUND (not FETCH_ERROR) when session state dir is missing', async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'promptly-copilot-missing-'));
      tempDirs.push(root);
      process.env.COPILOT_SESSION_STATE_DIR = path.join(root, 'does-not-exist');

      const priceMap: PriceMap = new Map([['gpt-5.4', { input_cost_per_token: 0.0001, output_cost_per_token: 0.0003 }]]);
      const result = await githubCopilotAdapter.run({
        priceMap,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-30'),
      });

      expect(result.connected).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.retriable).toBe(false);
    });

    it('validate() returns NOT_FOUND when session state dir is missing', async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'promptly-copilot-missing-'));
      tempDirs.push(root);
      process.env.COPILOT_SESSION_STATE_DIR = path.join(root, 'does-not-exist');

      const priceMap: PriceMap = new Map([['gpt-5.4', { input_cost_per_token: 0.0001, output_cost_per_token: 0.0003 }]]);
      const result = await githubCopilotAdapter.validate({ priceMap });

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('parses session.shutdown events with nested data structure and returns sessions', async () => {
      const { writeFile, mkdir } = await import('node:fs/promises');

      const root = await mkdtemp(path.join(os.tmpdir(), 'promptly-copilot-real-'));
      tempDirs.push(root);
      process.env.COPILOT_SESSION_STATE_DIR = root;

      const sessionDir = path.join(root, 'session-abc123');
      await mkdir(sessionDir);

      const event = {
        type: 'session.shutdown',
        data: {
          shutdownType: 'routine',
          totalPremiumRequests: 6,
          totalApiDurationMs: 284110,
          sessionStartTime: new Date('2026-06-15T00:00:00Z').getTime(),
          modelMetrics: {
            'claude-opus-4.6-1m': {
              requests: { count: 14, cost: 6 },
              usage: {
                inputTokens: 1083645,
                outputTokens: 13696,
                cacheReadTokens: 965895,
                cacheWriteTokens: 0,
              },
            },
          },
          currentModel: 'claude-opus-4.6-1m',
        },
        id: '35cf0647-8f0d-45dc-a001-9bdcef304cb6',
        timestamp: '2026-06-15T00:00:00.000Z',
        parentId: 'ffc0d173-311a-468f-8610-49c8804a6753',
      };
      await writeFile(path.join(sessionDir, 'events.jsonl'), JSON.stringify(event) + '\n', 'utf-8');

      const priceMap: PriceMap = new Map();
      const result = await githubCopilotAdapter.run({
        priceMap,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-30'),
      });

      expect(result.connected).toBe(true);
      expect(result.error).toBeNull();
      expect(result.raw).not.toBeNull();

      const sessions = (result.raw as any).copilotSessions;
      expect(sessions).toHaveLength(1);

      const session = sessions[0];
      expect(session.totalCost).toBe(6);
      expect(session.models['claude-opus-4.6-1m'].requestCount).toBe(14);
      expect(session.models['claude-opus-4.6-1m'].inputTokens).toBe(1083645);
      expect(session.models['claude-opus-4.6-1m'].outputTokens).toBe(13696);
      expect(session.models['claude-opus-4.6-1m'].cacheReadTokens).toBe(965895);
      expect(session.models['claude-opus-4.6-1m'].cacheWriteTokens).toBe(0);
    });

    it('skips events with missing data.sessionStartTime and emits malformed-file warning', async () => {
      const { writeFile, mkdir } = await import('node:fs/promises');

      const root = await mkdtemp(path.join(os.tmpdir(), 'promptly-copilot-malformed-'));
      tempDirs.push(root);
      process.env.COPILOT_SESSION_STATE_DIR = root;

      const sessionDir = path.join(root, 'session-xyz');
      await mkdir(sessionDir);

      const badEvent = { type: 'session.shutdown', data: { totalPremiumRequests: 3 } };
      await writeFile(path.join(sessionDir, 'events.jsonl'), JSON.stringify(badEvent) + '\n', 'utf-8');

      const priceMap: PriceMap = new Map();
      const result = await githubCopilotAdapter.run({
        priceMap,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-30'),
      });

      expect(result.connected).toBe(true);
      expect((result.raw as any).copilotSessions).toHaveLength(0);
      expect(result.warnings.some(w => w.includes('malformed'))).toBe(true);
    });

    it('includes session when endDate is noon-based Date', async () => {
      const { writeFile, mkdir } = await import('node:fs/promises');

      const root = await mkdtemp(path.join(os.tmpdir(), 'promptly-copilot-noon-'));
      tempDirs.push(root);
      process.env.COPILOT_SESSION_STATE_DIR = root;

      const sessionDir = path.join(root, 'session-noon');
      await mkdir(sessionDir);

      const todayAt6pm = new Date();
      todayAt6pm.setHours(18, 0, 0, 0);

      const event = {
        type: 'session.shutdown',
        data: {
          sessionStartTime: todayAt6pm.getTime(),
          totalPremiumRequests: 1,
          modelMetrics: {
            'gpt-5.4': { requests: { count: 1, cost: 1 }, usage: { inputTokens: 100, outputTokens: 50 } },
          },
        },
      };
      await writeFile(path.join(sessionDir, 'events.jsonl'), JSON.stringify(event) + '\n', 'utf-8');

      const endDate = new Date(); endDate.setHours(12, 0, 0, 0);
      const startDate = new Date(); startDate.setDate(startDate.getDate() - 29); startDate.setHours(12, 0, 0, 0);

      const priceMap: PriceMap = new Map();
      const result = await githubCopilotAdapter.run({ priceMap, startDate, endDate });

      const sessions = (result.raw as any)?.copilotSessions ?? [];
      expect(sessions).toHaveLength(1);
    });

    it('excludes sessions outside window', async () => {
      const { writeFile, mkdir } = await import('node:fs/promises');

      const root = await mkdtemp(path.join(os.tmpdir(), 'promptly-copilot-outside-'));
      tempDirs.push(root);
      process.env.COPILOT_SESSION_STATE_DIR = root;

      const sessionDir = path.join(root, 'session-outside');
      await mkdir(sessionDir);

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      sixtyDaysAgo.setHours(12, 0, 0, 0);

      const event = {
        type: 'session.shutdown',
        data: {
          sessionStartTime: sixtyDaysAgo.getTime(),
          totalPremiumRequests: 1,
          modelMetrics: {
            'gpt-5.4': { requests: { count: 1, cost: 1 }, usage: { inputTokens: 100, outputTokens: 50 } },
          },
        },
      };
      await writeFile(path.join(sessionDir, 'events.jsonl'), JSON.stringify(event) + '\n', 'utf-8');

      const endDate = new Date(); endDate.setHours(12, 0, 0, 0);
      const startDate = new Date(); startDate.setDate(startDate.getDate() - 29); startDate.setHours(12, 0, 0, 0);

      const priceMap: PriceMap = new Map();
      const result = await githubCopilotAdapter.run({ priceMap, startDate, endDate });

      const sessions = (result.raw as any)?.copilotSessions ?? [];
      expect(sessions).toHaveLength(0);
    });
  });
});
