import { describe, expect, it } from 'vitest';
import { normalizeSession } from '../src/adapters/githubCopilot.js';
import type { ShutdownEvent } from '../src/adapters/githubCopilot.js';

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
});
