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
      };

      const result = normalizeSession(event, 'test-events.jsonl');

      expect(result.models[model].cacheWriteTokens).toBe(150);
    });

    it('defaults cacheWriteTokens to 0 when field is absent', () => {
      const model = 'gpt-5.4-mini';
      const event: ShutdownEvent = {
        type: 'session.shutdown',
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
      };

      const result = normalizeSession(event, 'test-events.jsonl');

      expect(result.models[model].cacheWriteTokens).toBe(0);
    });

    it('uses totalPremiumRequests as totalCost when modelMetrics is empty', () => {
      const event: ShutdownEvent = {
        type: 'session.shutdown',
        sessionStartTime: new Date('2026-06-01T00:00:00Z').getTime(),
        modelMetrics: {},
        totalPremiumRequests: 42,
      };
      const result = normalizeSession(event, 'test-events.jsonl');
      expect(result.totalCost).toBe(42);
      expect(Object.keys(result.models)).toHaveLength(0);
    });

    it('uses totalPremiumRequests even when modelMetrics is present', () => {
      // totalCost is the raw field, not a recomputed sum — design §3.5
      const event: ShutdownEvent = {
        type: 'session.shutdown',
        sessionStartTime: new Date('2026-06-01T00:00:00Z').getTime(),
        modelMetrics: {
          'gpt-5.4': {
            requests: { count: 2, cost: 3 },
            usage: { inputTokens: 100, outputTokens: 40 },
          },
        },
        totalPremiumRequests: 15, // raw field disagrees — raw wins
      };
      const result = normalizeSession(event, 'test-events.jsonl');
      expect(result.totalCost).toBe(15);
    });

    it('defaults totalCost to 0 when totalPremiumRequests is absent', () => {
      const event: ShutdownEvent = {
        type: 'session.shutdown',
        sessionStartTime: new Date('2026-06-01T00:00:00Z').getTime(),
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
  });
});
