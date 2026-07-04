import { describe, expect, it } from 'vitest';
import type { PriceMap } from '../src/data/priceMap.js';
import { computeTierBMetrics } from '../src/engine/metrics/tierB.js';
import {
  copilotSessionCount,
  copilotTotalCost,
  copilotModelCostBreakdown,
  copilotTokenBreakdownByModel,
  copilotCachedTokenFraction,
} from '../src/engine/metrics/tierB.js';
import type { NormalizedCopilotSession, NormalizedSourceData } from '../src/types/index.js';

const base = (overrides: Partial<NormalizedSourceData>): NormalizedSourceData => ({
  sourceId: 'anthropic',
  periodStart: '2026-06-01T00:00:00Z',
  periodEnd: '2026-06-02T00:00:00Z',
  dailyTokensByModel: [],
  dailyCostUsd: [],
  ...overrides,
});

const session = (model: string, requestCost: number, extra?: Partial<{
  inputTokens: number; outputTokens: number;
  cacheReadTokens: number; cacheWriteTokens: number; reasoningTokens: number;
}>): NormalizedCopilotSession => ({
  date: '2026-06-01',
  sourceFile: '/tmp/test/events.jsonl',
  models: {
    [model]: {
      requestCount: 1, requestCost,
      inputTokens: extra?.inputTokens ?? 100,
      outputTokens: extra?.outputTokens ?? 50,
      cacheReadTokens: extra?.cacheReadTokens ?? 0,
      cacheWriteTokens: extra?.cacheWriteTokens ?? 0,
      reasoningTokens: extra?.reasoningTokens ?? 0,
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
  it('uses fixed 30-day windows for month-over-month change', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const dailyCostUsd = Array.from({ length: 90 }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      const day = index + 1;
      const costUsd = day <= 30 ? 1 : day <= 60 ? 2 : 4;
      return { date: date.toISOString().slice(0, 10), costUsd };
    });

    const dailyTokensByModel = dailyCostUsd.map(({ date }) => ({
      date,
      model: 'model-a',
      inputTokens: 10,
      outputTokens: 5,
    }));

    const metrics = computeTierBMetrics(base({
      sourceId: 'openai',
      periodStart: `${dailyCostUsd[0].date}T00:00:00Z`,
      periodEnd: `${dailyCostUsd[dailyCostUsd.length - 1].date}T00:00:00Z`,
      dailyCostUsd,
      dailyTokensByModel,
    }), priceMap);

    expect(metrics.momChangePct).toBeCloseTo(100);
  });

  it('returns null month-over-month change when fewer than 45 spend days exist', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const dailyCostUsd = Array.from({ length: 44 }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      return { date: date.toISOString().slice(0, 10), costUsd: 2 };
    });

    const metrics = computeTierBMetrics(base({
      sourceId: 'openai',
      dailyCostUsd,
      dailyTokensByModel: dailyCostUsd.map(({ date }) => ({
        date,
        model: 'model-a',
        inputTokens: 3,
        outputTokens: 2,
      })),
    }), priceMap);

    expect(metrics.momChangePct).toBeNull();
  });

  it('sums Copilot total cost from sessions', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'github_copilot',
      copilotSessions: [session('gpt-5.4', 3), session('gpt-5.4-mini', 4)],
    }), priceMap);
    expect(metrics.copilotTotalCostUsd).toBe(7);
  });

  it('sorts Copilot model cost breakdown descending by costUsd', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'github_copilot',
      copilotSessions: [session('low', 1), session('high', 5), session('middle', 3)],
    }), priceMap);
    expect(metrics.copilotModelCostBreakdown?.map(r => r.model)).toEqual(['high', 'middle', 'low']);
  });

  it('sets copilotSessionCount to the number of sessions', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'github_copilot',
      copilotSessions: [session('gpt-5.4', 5), session('gpt-5.4', 3)],
    }), priceMap);
    expect(metrics.copilotSessionCount).toBe(2);
  });

  it('aggregates copilotDailyInputTokens by day across sessions and models', () => {
    const copilotSessions: NormalizedCopilotSession[] = [
      {
        date: '2026-06-01',
        sourceFile: 'f1.jsonl',
        models: {
          'gpt-5.4': {
            requestCount: 1,
            requestCost: 2,
            inputTokens: 100,
            outputTokens: 20,
            cacheReadTokens: 10,
            cacheWriteTokens: 0,
            reasoningTokens: 0,
          },
          'gpt-5.4-mini': {
            requestCount: 1,
            requestCost: 1,
            inputTokens: 50,
            outputTokens: 15,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            reasoningTokens: 0,
          },
        },
        totalCost: 3,
      },
      {
        date: '2026-06-01',
        sourceFile: 'f2.jsonl',
        models: {
          'gpt-5.5': {
            requestCount: 1,
            requestCost: 4,
            inputTokens: 70,
            outputTokens: 30,
            cacheReadTokens: 5,
            cacheWriteTokens: 0,
            reasoningTokens: 0,
          },
        },
        totalCost: 4,
      },
      {
        date: '2026-06-02',
        sourceFile: 'f3.jsonl',
        models: {
          'gpt-5.4': {
            requestCount: 1,
            requestCost: 2,
            inputTokens: 40,
            outputTokens: 10,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            reasoningTokens: 0,
          },
        },
        totalCost: 2,
      },
    ];

    const metrics = computeTierBMetrics(base({
      sourceId: 'github_copilot',
      copilotSessions,
    }), priceMap);

    expect(metrics.copilotDailyInputTokens).toEqual([
      { date: '2026-06-01', inputTokens: 220 },
      { date: '2026-06-02', inputTokens: 40 },
    ]);
  });

  it('computes copilotAvgTokensPerSession as total tokens divided by session count', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'github_copilot',
      copilotSessions: [
        session('gpt-5.4', 3, { inputTokens: 100, outputTokens: 25 }),
        session('gpt-5.4-mini', 4, { inputTokens: 50, outputTokens: 25 }),
      ],
    }), priceMap);

    expect(metrics.copilotAvgTokensPerSession).toBe(100);
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

  it('sets totalSpendUsd to totalActualSpendUsd for OpenAI and copilotTotalCostUsd for Copilot', () => {
    const openaiMetrics = computeTierBMetrics(base({
      sourceId: 'openai',
      dailyTokensByModel: [{ date: '2026-06-01', model: 'model-a', inputTokens: 10, outputTokens: 5 }],
      dailyCostUsd: [{ date: '2026-06-01', costUsd: 12.5 }],
    }), priceMap);

    const copilotMetrics = computeTierBMetrics(base({
      sourceId: 'github_copilot',
      copilotSessions: [session('gpt-5.4', 7)],
    }), priceMap);

    expect(openaiMetrics.totalSpendUsd).toBe(openaiMetrics.totalActualSpendUsd);
    expect(copilotMetrics.totalSpendUsd).toBe(copilotMetrics.copilotTotalCostUsd);
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

  it('sets projectedR1SavingsUsd for Anthropic with cached tokens and omits it for OpenAI', () => {
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

    const openai = computeTierBMetrics(base({
      sourceId: 'openai',
      dailyTokensByModel: [{
        date: '2026-06-01',
        model: 'model-a',
        inputTokens: 100,
        outputTokens: 10,
      }],
      dailyCostUsd: [{ date: '2026-06-01', costUsd: 1 }],
    }), priceMap);

    expect(anthropic.projectedR1SavingsUsd).toBeGreaterThan(0);
    expect(openai.projectedR1SavingsUsd).toBeUndefined();
  });

  // New MF-3 tests: copilotTokenBreakdownByModel
  it('copilotTokenBreakdownByModel aggregates tokens across sessions', () => {
    const s1: NormalizedCopilotSession = {
      date: '2026-06-01', sourceFile: 'f.jsonl',
      models: { 'model-x': { requestCount: 2, requestCost: 3, inputTokens: 200, outputTokens: 80, cacheReadTokens: 40, cacheWriteTokens: 20, reasoningTokens: 10 } },
      totalCost: 3,
    };
    const s2: NormalizedCopilotSession = {
      date: '2026-06-02', sourceFile: 'f.jsonl',
      models: { 'model-x': { requestCount: 1, requestCost: 2, inputTokens: 100, outputTokens: 30, cacheReadTokens: 15, cacheWriteTokens: 5, reasoningTokens: 0 } },
      totalCost: 2,
    };
    const result = copilotTokenBreakdownByModel([s1, s2]);
    expect(result).toHaveLength(1);
    expect(result[0].model).toBe('model-x');
    expect(result[0].requestCount).toBe(3);
    expect(result[0].requestCost).toBe(5);
    expect(result[0].inputTokens).toBe(300);
    expect(result[0].outputTokens).toBe(110);
    expect(result[0].cacheReadTokens).toBe(55);
    expect(result[0].cacheWriteTokens).toBe(25);
    expect(result[0].reasoningTokens).toBe(10);
  });

  it('copilotTokenBreakdownByModel sorts descending by requestCost', () => {
    const sessions = [
      session('cheap', 1), session('expensive', 9), session('middle', 4),
    ];
    const result = copilotTokenBreakdownByModel(sessions);
    expect(result.map(r => r.model)).toEqual(['expensive', 'middle', 'cheap']);
  });

  it('copilotTokenBreakdownByModel returns empty array for empty sessions', () => {
    expect(copilotTokenBreakdownByModel([])).toEqual([]);
  });

  // New MF-3 tests: copilotCachedTokenFraction
  it('copilotCachedTokenFraction computes per-model fractions correctly', () => {
    const s: NormalizedCopilotSession = {
      date: '2026-06-01', sourceFile: 'f.jsonl',
      models: {
        'model-a': { requestCount: 1, requestCost: 1, inputTokens: 1000, outputTokens: 100, cacheReadTokens: 300, cacheWriteTokens: 0, reasoningTokens: 0 },
        'model-b': { requestCount: 1, requestCost: 2, inputTokens: 500, outputTokens: 50, cacheReadTokens: 100, cacheWriteTokens: 0, reasoningTokens: 0 },
      },
      totalCost: 3,
    };
    const result = copilotCachedTokenFraction([s]);
    const ma = result.perModel.find(m => m.model === 'model-a');
    const mb = result.perModel.find(m => m.model === 'model-b');
    expect(ma?.fraction).toBeCloseTo(0.3);
    expect(mb?.fraction).toBeCloseTo(0.2);
    expect(result.aggregate).toBeCloseTo(400 / 1500);
  });

  it('copilotCachedTokenFraction aggregate is 0 when no input tokens', () => {
    const result = copilotCachedTokenFraction([]);
    expect(result.aggregate).toBe(0);
    expect(result.perModel).toHaveLength(0);
  });

  it('copilotCachedTokenFraction handles division by zero per-model', () => {
    const s: NormalizedCopilotSession = {
      date: '2026-06-01', sourceFile: 'f.jsonl',
      models: { 'model-z': { requestCount: 1, requestCost: 1, inputTokens: 0, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 } },
      totalCost: 1,
    };
    const result = copilotCachedTokenFraction([s]);
    expect(result.perModel[0].fraction).toBe(0);
    expect(result.aggregate).toBe(0);
  });

  it('computeTierBMetrics populates copilotCachedTokenFraction on github_copilot', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'github_copilot',
      copilotSessions: [session('m', 5, { inputTokens: 400, cacheReadTokens: 100 })],
    }), priceMap);
    expect(metrics.copilotCachedTokenFraction).toBeDefined();
    expect(metrics.copilotCachedTokenFraction?.aggregate).toBeCloseTo(0.25);
  });

  it('computeTierBMetrics populates copilotTokenBreakdownByModel on github_copilot', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'github_copilot',
      copilotSessions: [session('m', 5)],
    }), priceMap);
    expect(metrics.copilotTokenBreakdownByModel).toBeDefined();
    expect(metrics.copilotTokenBreakdownByModel?.[0].model).toBe('m');
    expect(metrics.copilotTokenBreakdownByModel?.[0].requestCost).toBe(5);
  });
});

describe('Copilot pure metric functions', () => {
  const sessions = [
    session('model-a', 3),
    session('model-b', 5),
    session('model-a', 2),
  ];

  describe('copilotSessionCount', () => {
    it('returns 0 for empty array', () => { expect(copilotSessionCount([])).toBe(0); });
    it('returns the session array length', () => { expect(copilotSessionCount(sessions)).toBe(3); });
  });

  describe('copilotTotalCost', () => {
    it('returns 0 for empty array', () => { expect(copilotTotalCost([])).toBe(0); });
    it('sums totalCost across all sessions', () => { expect(copilotTotalCost(sessions)).toBe(10); });
    it('sums correctly when all sessions use the same model', () => {
      const same = [session('gpt-5.4', 4), session('gpt-5.4', 6)];
      expect(copilotTotalCost(same)).toBe(10);
    });
  });

  describe('copilotModelCostBreakdown', () => {
    it('returns empty array for empty input', () => {
      const result = copilotModelCostBreakdown([]);
      expect(result.copilotModelCostBreakdown).toHaveLength(0);
      expect(result.copilotTotalInputTokens).toBe(0);
      expect(result.copilotTotalOutputTokens).toBe(0);
    });
    it('computes correct spend share for each model', () => {
      const result = copilotModelCostBreakdown(sessions);
      const modelA = result.copilotModelCostBreakdown.find(r => r.model === 'model-a');
      const modelB = result.copilotModelCostBreakdown.find(r => r.model === 'model-b');
      expect(modelA?.costUsd).toBe(5);
      expect(modelA?.costShare).toBeCloseTo(0.5);
      expect(modelB?.costUsd).toBe(5);
      expect(modelB?.costShare).toBeCloseTo(0.5);
    });
    it('sorts copilotModelCostBreakdown descending by costUsd', () => {
      const uneven = [session('cheap', 1), session('expensive', 9)];
      const result = copilotModelCostBreakdown(uneven);
      expect(result.copilotModelCostBreakdown[0].model).toBe('expensive');
    });
    it('aggregates input and output tokens across sessions', () => {
      const result = copilotModelCostBreakdown(sessions);
      expect(result.copilotTotalInputTokens).toBe(300);
      expect(result.copilotTotalOutputTokens).toBe(150);
    });
  });

  describe('copilotTokenBreakdownByModel', () => {
    it('returns array sorted descending by requestCost', () => {
      const result = copilotTokenBreakdownByModel(sessions);
      expect(result).toBeInstanceOf(Array);
      // model-a: 3+2=5, model-b: 5 — tie; both appear
      expect(result.length).toBe(2);
    });
    it('returns empty array for empty sessions', () => {
      expect(copilotTokenBreakdownByModel([])).toEqual([]);
    });
  });

  describe('copilotCachedTokenFraction', () => {
    it('returns object with perModel and aggregate', () => {
      const result = copilotCachedTokenFraction(sessions);
      expect(result).toHaveProperty('perModel');
      expect(result).toHaveProperty('aggregate');
    });
    it('returns aggregate 0 for empty sessions', () => {
      const result = copilotCachedTokenFraction([]);
      expect(result.aggregate).toBe(0);
      expect(result.perModel).toHaveLength(0);
    });
  });
});
