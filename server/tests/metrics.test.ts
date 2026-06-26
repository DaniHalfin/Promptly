import { describe, expect, it } from 'vitest';
import type { PriceMap } from '../src/data/priceMap.js';
import { computeTierBMetrics } from '../src/engine/metrics/tierB.js';
import type { NormalizedCopilotSession, NormalizedSourceData } from '../src/types/index.js';

const base = (overrides: Partial<NormalizedSourceData>): NormalizedSourceData => ({
  sourceId: 'anthropic',
  periodStart: '2026-06-01T00:00:00Z',
  periodEnd: '2026-06-02T00:00:00Z',
  dailyTokensByModel: [],
  dailyCostUsd: [],
  ...overrides,
});

const session = (model: string, requestCost: number): NormalizedCopilotSession => ({
  date: '2026-06-01',
  sourceFile: '/tmp/test/events.jsonl',
  models: {
    [model]: {
      requestCount: 1, requestCost,
      inputTokens: 100, outputTokens: 50,
      cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0,
    },
  },
  totalCost: requestCost,
});

const priceMap: PriceMap = new Map([[
  'model-a',
  {
    input_cost_per_token: 1,
    output_cost_per_token: 2,
    cache_creation_input_token_cost: 0.5,
    cache_read_input_token_cost: 0.1,
  },
]]);

describe('computeTierBMetrics', () => {
  it('sums Copilot net spend from sessions', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'github_copilot',
      copilotSessions: [session('gpt-5.4', 3), session('gpt-5.4-mini', 4)],
    }), priceMap);
    expect(metrics.copilotNetSpendUsd).toBe(7);
  });

  it('sorts Copilot spend by model descending by net amount', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'github_copilot',
      copilotSessions: [session('low', 1), session('high', 5), session('middle', 3)],
    }), priceMap);
    expect(metrics.copilotSpendByModel?.map(r => r.model)).toEqual(['high', 'middle', 'low']);
  });

  it('sets copilotSessionCount to the number of sessions', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'github_copilot',
      copilotSessions: [session('gpt-5.4', 5), session('gpt-5.4', 3)],
    }), priceMap);
    expect(metrics.copilotSessionCount).toBe(2);
  });

  it('computes Claude Code cached-token fraction', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'claude_code',
      dailyTokensByModel: [{
        date: '2026-06-01',
        model: 'model-a',
        inputTokens: 100,
        outputTokens: 10,
        cacheCreationInputTokens: 50,
        cacheReadInputTokens: 50,
      }],
      dailyCostUsd: [{ date: '2026-06-01', costUsd: 1 }],
    }), priceMap);

    expect(metrics.cachedTokenFractionClaudeCode).toBeCloseTo(50 / 200);
  });

  it('marks all OpenAI model breakdown entries as estimated', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'openai',
      dailyTokensByModel: [
        { date: '2026-06-01', model: 'model-a', inputTokens: 10, outputTokens: 5 },
        { date: '2026-06-01', model: 'unknown-model', inputTokens: 10, outputTokens: 5 },
      ],
      dailyCostUsd: [{ date: '2026-06-01', costUsd: 1 }],
    }), priceMap);

    expect(metrics.modelBreakdown).toHaveLength(1);
    expect(metrics.modelBreakdown?.every(entry => entry.estimated === true)).toBe(true);
  });

  it('includes cache creation and cache read costs in model cost', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'anthropic',
      dailyTokensByModel: [{
        date: '2026-06-01',
        model: 'model-a',
        inputTokens: 10,
        outputTokens: 20,
        cacheCreationInputTokens: 30,
        cacheReadInputTokens: 40,
      }],
      dailyCostUsd: [{ date: '2026-06-01', costUsd: 69 }],
    }), priceMap);

    expect(metrics.modelBreakdown?.[0]?.estimatedCostUsd).toBeCloseTo(69);
  });

  it('uses source-specific cache fields for Anthropic and Claude Code', () => {
    const anthropic = computeTierBMetrics(base({
      sourceId: 'anthropic',
      dailyTokensByModel: [{
        date: '2026-06-01',
        model: 'model-a',
        inputTokens: 100,
        outputTokens: 10,
        cacheCreationInputTokens: 20,
        cacheReadInputTokens: 30,
      }],
      dailyCostUsd: [{ date: '2026-06-01', costUsd: 1 }],
    }), priceMap);

    const claudeCode = computeTierBMetrics(base({
      sourceId: 'claude_code',
      dailyTokensByModel: [{
        date: '2026-06-01',
        model: 'model-a',
        inputTokens: 100,
        outputTokens: 10,
        cacheCreationInputTokens: 20,
        cacheReadInputTokens: 30,
      }],
      dailyCostUsd: [{ date: '2026-06-01', costUsd: 1 }],
      sessionCount: 2,
    }), priceMap);

    expect(anthropic.cachedTokenFractionAnthropic).toBeDefined();
    expect(anthropic.cachedTokenFractionClaudeCode).toBeUndefined();
    expect(anthropic.totalInputTokensAnthropic).toBe(150);
    expect(anthropic.totalInputTokensClaudeCode).toBeUndefined();

    expect(claudeCode.cachedTokenFractionClaudeCode).toBeDefined();
    expect(claudeCode.cachedTokenFractionAnthropic).toBeUndefined();
    expect(claudeCode.totalInputTokensClaudeCode).toBe(150);
    expect(claudeCode.totalInputTokensAnthropic).toBeUndefined();
  });
});

