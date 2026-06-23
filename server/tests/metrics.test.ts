import { describe, expect, it } from 'vitest';
import type { PriceMap } from '../src/data/priceMap.js';
import { computeTierBMetrics } from '../src/engine/metrics/tierB.js';
import type { NormalizedCopilotBillingItem, NormalizedSourceData } from '../src/types/index.js';

const base = (overrides: Partial<NormalizedSourceData>): NormalizedSourceData => ({
  sourceId: 'anthropic',
  periodStart: '2026-06-01T00:00:00Z',
  periodEnd: '2026-06-02T00:00:00Z',
  dailyTokensByModel: [],
  dailyCostUsd: [],
  ...overrides,
});

const billingItem = (model: string, netAmountUsd: number): NormalizedCopilotBillingItem => ({
  date: '2026-06-01',
  product: 'copilot',
  model,
  pricePerUnit: netAmountUsd,
  grossQuantity: 1,
  grossAmountUsd: netAmountUsd + 1,
  discountAmountUsd: 1,
  netAmountUsd,
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
  it('sums Copilot net spend from billing items', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'github_copilot',
      copilotBillingItems: [billingItem('gpt-5.4', 3), billingItem('gpt-5.4-mini', 4)],
    }), priceMap);

    expect(metrics.copilotNetSpendUsd).toBe(7);
  });

  it('sorts Copilot spend by model descending by net amount', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'github_copilot',
      copilotBillingItems: [
        billingItem('low', 1),
        billingItem('high', 5),
        billingItem('middle', 3),
      ],
    }), priceMap);

    expect(metrics.copilotSpendByModel?.map(row => row.model)).toEqual(['high', 'middle', 'low']);
  });

  it('sets Copilot acceptance rate to null when there is no engagement data', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'github_copilot',
      copilotBillingItems: [billingItem('gpt-5.4', 5)],
    }), priceMap);

    expect(metrics.copilotAcceptanceRate).toBeNull();
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

