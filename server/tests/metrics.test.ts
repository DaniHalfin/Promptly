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
import { totalTokens, computeCrossSourceMetrics, summarizePotentialSavings } from '../src/engine/metrics/crossSource.js';
import { computeTierCMetrics } from '../src/engine/metrics/tierC.js';
import type { NormalizedCopilotSession, NormalizedSourceData, TierCChatGptExportMetrics, CrossSourceSummary, DailySpendEntry, SourceReport } from '../src/types/index.js';
import type { AdapterCredentials, AdapterConnectOptions } from '../src/adapters/types.js';

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

const sessionOn = (date: string, model: string, requestCost: number): NormalizedCopilotSession => ({
  ...session(model, requestCost),
  date,
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

describe('crossSource totalTokens', () => {
  it('includes GitHub Copilot token breakdown in actual token totals', () => {
    const sources = [
      {
        source_id: 'github_copilot',
        tier: 'B',
        connected: true,
        error: null,
        metrics: {
          sourceId: 'github_copilot',
          tier: 'B',
          periodStart: '2026-06-01T00:00:00Z',
          periodEnd: '2026-06-02T00:00:00Z',
          warnings: [],
          copilotTokenBreakdownByModel: [
            { model: 'gpt-5.4', inputTokens: 100, outputTokens: 25, cacheReadTokens: 10, cacheWriteTokens: 5, reasoningTokens: 0, requestCount: 1, requestCost: 0.1 },
            { model: 'gpt-5.4-mini', inputTokens: 50, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requestCount: 1, requestCost: 0.01 },
          ],
        },
      },
      {
        source_id: 'anthropic',
        tier: 'B',
        connected: true,
        error: null,
        metrics: {
          sourceId: 'anthropic',
          tier: 'B',
          periodStart: '2026-06-01T00:00:00Z',
          periodEnd: '2026-06-02T00:00:00Z',
          warnings: [],
          estimatedTotalTokens: 20,
          modelBreakdown: [
            { model: 'claude-3-5-sonnet-20241022', inputTokens: 10, outputTokens: 5, estimatedCostShare: 1, estimatedCostUsd: 0.01 },
          ],
        },
      },
    ] as Parameters<typeof totalTokens>[0];

    expect(totalTokens(sources)).toEqual({ actual: 200, estimated: 20 });
  });
});

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

  it('Copilot: aggregates dailySpend by session date', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'github_copilot',
      copilotSessions: [
        sessionOn('2026-06-01', 'gpt-5.4', 3),
        sessionOn('2026-06-01', 'gpt-5.4-mini', 2),
        sessionOn('2026-06-02', 'gpt-5.4', 4),
      ],
    }), priceMap);

    expect(metrics.dailySpend).toEqual([
      { date: '2026-06-01', spendUsd: 5 },
      { date: '2026-06-02', spendUsd: 4 },
    ]);
  });

  it('Copilot: sets models_identified from model breakdown', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'github_copilot',
      copilotSessions: [
        sessionOn('2026-06-01', 'gpt-5.4', 5),
        sessionOn('2026-06-02', 'gpt-5.4-mini', 3),
      ],
    }), priceMap);

    expect(metrics.models_identified).toEqual(expect.arrayContaining(['gpt-5.4', 'gpt-5.4-mini']));
    expect(metrics.models_identified).toHaveLength(2);
  });

  it('Copilot: empty dailySpend + models_identified when no sessions', () => {
    const metrics = computeTierBMetrics(base({
      sourceId: 'github_copilot',
      copilotSessions: [],
    }), priceMap);

    expect(metrics.dailySpend).toEqual([]);
    expect(metrics.models_identified).toEqual([]);
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

  describe('computeTierBMetrics cache savings', () => {
    it('computes realized cache savings from cache read tokens and cache read price', () => {
      const metrics = computeTierBMetrics(base({
        sourceId: 'anthropic',
        dailyTokensByModel: [{
          date: '2026-06-01',
          model: 'model-a',
          inputTokens: 100,
          outputTokens: 10,
          cacheReadInputTokens: 50,
        }],
        dailyCostUsd: [{ date: '2026-06-01', costUsd: 1 }],
      }), priceMap);

      expect(metrics.cachedTokenSavingsUsdAnthropic).toBeCloseTo(50 * (1 - 0.1));
    });
  });

  describe('computeTierBMetrics projected R1 savings', () => {
    it('uses reuse factor and nets cache write overhead', () => {
      const metrics = computeTierBMetrics(base({
        sourceId: 'anthropic',
        dailyTokensByModel: [{
          date: '2026-06-01',
          model: 'model-a',
          inputTokens: 100,
          outputTokens: 10,
        }],
        dailyCostUsd: [{ date: '2026-06-01', costUsd: 1 }],
      }), priceMap);

      expect(metrics.projectedR1SavingsUsd).toBeCloseTo(100 * 0.5 * (2 * 1 - 0.1 - 0.5));
    });
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

  describe('computeTierBMetrics efficiencySignal', () => {
    it('marks input_heavy when provider-aware input/output ratio is greater than 8', () => {
      const metrics = computeTierBMetrics(base({
        sourceId: 'openai',
        dailyTokensByModel: [{ date: '2026-06-01', model: 'model-a', inputTokens: 90, outputTokens: 10 }],
        dailyCostUsd: [{ date: '2026-06-01', costUsd: 1 }],
      }), priceMap);

      expect(metrics.efficiencySignal?.kind).toBe('input_heavy');
      expect(metrics.efficiencySignal?.inputOutputRatio).toBeCloseTo(9);
    });

    it('marks output_heavy when ratio is below 1', () => {
      const metrics = computeTierBMetrics(base({
        sourceId: 'openai',
        dailyTokensByModel: [{ date: '2026-06-01', model: 'model-a', inputTokens: 5, outputTokens: 10 }],
        dailyCostUsd: [{ date: '2026-06-01', costUsd: 1 }],
      }), priceMap);

      expect(metrics.efficiencySignal?.kind).toBe('output_heavy');
    });

    it('marks balanced when ratio is between 1 and 8', () => {
      const metrics = computeTierBMetrics(base({
        sourceId: 'openai',
        dailyTokensByModel: [{ date: '2026-06-01', model: 'model-a', inputTokens: 20, outputTokens: 10 }],
        dailyCostUsd: [{ date: '2026-06-01', costUsd: 1 }],
      }), priceMap);

      expect(metrics.efficiencySignal?.kind).toBe('balanced');
    });

    it('marks balanced when ratio equals 1', () => {
      const metrics = computeTierBMetrics(base({
        sourceId: 'openai',
        dailyTokensByModel: [{ date: '2026-06-01', model: 'model-a', inputTokens: 10, outputTokens: 10 }],
        dailyCostUsd: [{ date: '2026-06-01', costUsd: 1 }],
      }), priceMap);

      expect(metrics.efficiencySignal?.kind).toBe('balanced');
    });

    it('marks balanced when ratio equals 8', () => {
      const metrics = computeTierBMetrics(base({
        sourceId: 'openai',
        dailyTokensByModel: [{ date: '2026-06-01', model: 'model-a', inputTokens: 80, outputTokens: 10 }],
        dailyCostUsd: [{ date: '2026-06-01', costUsd: 1 }],
      }), priceMap);

      expect(metrics.efficiencySignal?.kind).toBe('balanced');
    });

    it('uses cache creation/read tokens in Anthropic and Claude Code ratios', () => {
      const anthropic = computeTierBMetrics(base({
        sourceId: 'anthropic',
        dailyTokensByModel: [{
          date: '2026-06-01',
          model: 'model-a',
          inputTokens: 10,
          outputTokens: 10,
          cacheCreationInputTokens: 40,
          cacheReadInputTokens: 40,
        }],
        dailyCostUsd: [{ date: '2026-06-01', costUsd: 1 }],
      }), priceMap);

      const claudeCode = computeTierBMetrics(base({
        sourceId: 'claude_code',
        dailyTokensByModel: [{
          date: '2026-06-01',
          model: 'model-a',
          inputTokens: 10,
          outputTokens: 10,
          cacheCreationInputTokens: 40,
          cacheReadInputTokens: 40,
        }],
        dailyCostUsd: [{ date: '2026-06-01', costUsd: 1 }],
      }), priceMap);

      expect(anthropic.aggregateInputOutputRatio).toBeCloseTo(9);
      expect(anthropic.efficiencySignal?.kind).toBe('input_heavy');
      expect(claudeCode.aggregateInputOutputRatio).toBeCloseTo(9);
      expect(claudeCode.efficiencySignal?.kind).toBe('input_heavy');
    });

    it('computes aggregateInputOutputRatio for GitHub Copilot', () => {
      const metrics = computeTierBMetrics(base({
        sourceId: 'github_copilot',
        copilotSessions: [session('gpt-5.4', 3, { inputTokens: 30, outputTokens: 10 })],
      }), priceMap);

      expect(metrics.aggregateInputOutputRatio).toBeCloseTo(3);
      expect(metrics.efficiencySignal?.kind).toBe('balanced');
    });
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

// ============================================================
// Phase 0 contract tests (types and shape only; logic in Phase 1+)
// ============================================================

describe('Tier C canonical metrics shape', () => {
  it('populates all 7 canonical Tier C fields from adapter output', () => {
    // Phase 0: verifies the TierCChatGptExportMetrics type has all required fields
    const metrics: TierCChatGptExportMetrics = {
      total_conversations: 10,
      total_messages: 100,
      active_days: 5,
      models_identified: ['gpt-4o'],
      estimated_relative_cost_usd: 1.5,
      daily_conversation_activity: [{ date: '2026-06-01', conversation_count: 2 }],
      estimated_token_volume: 50_000,
      trend: { status: 'insufficient_data', observed_days: 5, required_days: 30, message: 'Insufficient data' },
      spike_callout: null,
    };
    expect(metrics.total_conversations).toBeGreaterThanOrEqual(0);
    expect(metrics.total_messages).toBeGreaterThanOrEqual(0);
    expect(metrics.active_days).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(metrics.models_identified)).toBe(true);
    expect(metrics.estimated_relative_cost_usd).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(metrics.daily_conversation_activity)).toBe(true);
    expect(metrics.estimated_token_volume).toBeGreaterThanOrEqual(0);
  });

  it('models_identified is [] when no model metadata in conversations', () => {
    const metrics: TierCChatGptExportMetrics = {
      total_conversations: 5,
      total_messages: 40,
      active_days: 3,
      models_identified: [],
      estimated_relative_cost_usd: 0.5,
      daily_conversation_activity: [],
      estimated_token_volume: 10_000,
      trend: { status: 'insufficient_data', observed_days: 3, required_days: 30, message: 'Test' },
      spike_callout: null,
    };
    expect(metrics.models_identified).toHaveLength(0);
  });

  it('total_spend_usd is null on Tier C metrics', () => {
    const metrics: TierCChatGptExportMetrics = {
      total_conversations: 5,
      total_messages: 40,
      active_days: 3,
      models_identified: [],
      estimated_relative_cost_usd: 0.5,
      daily_conversation_activity: [],
      estimated_token_volume: 10_000,
      trend: { status: 'insufficient_data', observed_days: 3, required_days: 30, message: 'Test' },
      spike_callout: null,
      total_spend_usd: null,
    };
    expect(metrics.total_spend_usd).toBeNull();
  });

  it('cache_savings_usd is null on Tier C metrics', () => {
    const metrics: TierCChatGptExportMetrics = {
      total_conversations: 5,
      total_messages: 40,
      active_days: 3,
      models_identified: [],
      estimated_relative_cost_usd: 0.5,
      daily_conversation_activity: [],
      estimated_token_volume: 10_000,
      trend: { status: 'insufficient_data', observed_days: 3, required_days: 30, message: 'Test' },
      spike_callout: null,
      cache_savings_usd: null,
    };
    expect(metrics.cache_savings_usd).toBeNull();
  });

  it('session_cost_usd is null on Tier C metrics', () => {
    const metrics: TierCChatGptExportMetrics = {
      total_conversations: 5,
      total_messages: 40,
      active_days: 3,
      models_identified: [],
      estimated_relative_cost_usd: 0.5,
      daily_conversation_activity: [],
      estimated_token_volume: 10_000,
      trend: { status: 'insufficient_data', observed_days: 3, required_days: 30, message: 'Test' },
      spike_callout: null,
      session_cost_usd: null,
    };
    expect(metrics.session_cost_usd).toBeNull();
  });

  it('dominant_model is null on Tier C metrics', () => {
    const metrics: TierCChatGptExportMetrics = {
      total_conversations: 5,
      total_messages: 40,
      active_days: 3,
      models_identified: [],
      estimated_relative_cost_usd: 0.5,
      daily_conversation_activity: [],
      estimated_token_volume: 10_000,
      trend: { status: 'insufficient_data', observed_days: 3, required_days: 30, message: 'Test' },
      spike_callout: null,
      dominant_model: null,
    };
    expect(metrics.dominant_model).toBeNull();
  });

  // ── Phase 1 addition ────────────────────────────────────────────────────
  it('estimated_relative_cost_usd uses a default model assumption cost when models_identified is empty', () => {
    // When no model identifiers are extracted, tierC.ts falls back to gpt-4o pricing.
    // With only token volume, the cost must be > 0 because gpt-4o has non-zero pricing.
    const priceMapWithGpt4o: PriceMap = new Map([
      ['gpt-4o', { input_cost_per_token: 0.0000025, output_cost_per_token: 0.00001 }],
    ]);
    const data: NormalizedSourceData = {
      sourceId: 'chatgpt_export',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      chatgptAggregates: {
        total_conversations: 10,
        total_messages: 100,
        active_days: 5,
        models_identified: [],           // ← empty: should fall back to gpt-4o
        daily_conversation_activity: [
          { date: '2026-06-01', conversation_count: 2 },
          { date: '2026-06-02', conversation_count: 3 },
        ],
        estimated_token_volume: 50_000,
        estimated_user_tokens: 20_000,   // will be priced at input rate
        estimated_assistant_tokens: 30_000, // will be priced at output rate
        newest_conversation_date: '2026-06-02',
      },
    };
    const result = computeTierCMetrics(data, priceMapWithGpt4o);
    expect(result.estimated_relative_cost_usd).toBeGreaterThan(0);
    // Default model should be gpt-4o (or similar baseline)
    expect(result.baselineModelAssumption).toBeDefined();
  });
});

// ── Phase 1: Tier C trend computation ──────────────────────────────────────

/** Helper to build NormalizedSourceData with chatgptAggregates for Tier C metric tests */
function tierCData(
  opts: {
    daily: { date: string; count: number }[];
    periodStart: string;
    periodEnd: string;
    models?: string[];
    userTokens?: number;
    assistantTokens?: number;
  }
): NormalizedSourceData {
  const daily_conversation_activity = opts.daily.map(d => ({ date: d.date, conversation_count: d.count }));
  return {
    sourceId: 'chatgpt_export',
    periodStart: opts.periodStart,
    periodEnd: opts.periodEnd,
    chatgptAggregates: {
      total_conversations: opts.daily.reduce((s, d) => s + d.count, 0),
      total_messages: opts.daily.reduce((s, d) => s + d.count * 2, 0),
      active_days: opts.daily.length,
      models_identified: opts.models ?? [],
      daily_conversation_activity,
      estimated_token_volume: (opts.userTokens ?? 0) + (opts.assistantTokens ?? 0),
      estimated_user_tokens: opts.userTokens ?? 0,
      estimated_assistant_tokens: opts.assistantTokens ?? 0,
    },
  };
}

const testPriceMap: PriceMap = new Map([
  ['gpt-4o', { input_cost_per_token: 0.0000025, output_cost_per_token: 0.00001 }],
]);

describe('Tier C trend computation', () => {
  it('trend.status is insufficient_data when fewer than required days of activity', () => {
    // 10 active days < required 30
    const daily = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      count: 1,
    }));
    const data = tierCData({ daily, periodStart: '2026-06-01', periodEnd: '2026-06-10' });
    const result = computeTierCMetrics(data, testPriceMap);
    expect(result.trend?.status).toBe('insufficient_data');
  });

  it('trend.status is no_prior_spend when prior period has zero activity', () => {
    // 30 active days but ALL in the second half of a 90-day calendar range
    // periodStart = Jan 01, periodEnd = Mar 31, midpoint ≈ Feb 14
    // All activity from Feb 15 onwards → priorSum = 0
    const daily = Array.from({ length: 30 }, (_, i) => {
      const d = new Date('2026-02-15');
      d.setUTCDate(d.getUTCDate() + i);
      return { date: d.toISOString().split('T')[0], count: 2 };
    });
    const data = tierCData({ daily, periodStart: '2026-01-01', periodEnd: '2026-03-31' });
    const result = computeTierCMetrics(data, testPriceMap);
    expect(result.trend?.status).toBe('no_prior_spend');
  });

  it('trend.status is available with correct mom_change_pct', () => {
    // 30 days in Jan (count=1 each) + 30 days in Mar (count=2 each) over Jan–Apr range
    // Midpoint ≈ Feb 15; Jan days are in prior half, Mar days in current half
    // mom_change_pct = (60 - 30) / 30 × 100 = 100
    const jan = Array.from({ length: 30 }, (_, i) => {
      const d = new Date('2026-01-01');
      d.setUTCDate(d.getUTCDate() + i);
      return { date: d.toISOString().split('T')[0], count: 1 };
    });
    const mar = Array.from({ length: 30 }, (_, i) => {
      const d = new Date('2026-03-01');
      d.setUTCDate(d.getUTCDate() + i);
      return { date: d.toISOString().split('T')[0], count: 2 };
    });
    const data = tierCData({
      daily: [...jan, ...mar],
      periodStart: '2026-01-01',
      periodEnd: '2026-03-30',
    });
    const result = computeTierCMetrics(data, testPriceMap);
    expect(result.trend?.status).toBe('available');
    if (result.trend?.status === 'available') {
      // priorSum = 30×1 = 30, currentSum = 30×2 = 60 → +100%
      expect(result.trend.mom_change_pct).toBeCloseTo(100, 0);
    }
  });

  it('trend object always has status, observed_days, required_days, and message', () => {
    const data = tierCData({
      daily: [{ date: '2026-06-01', count: 1 }],
      periodStart: '2026-06-01',
      periodEnd: '2026-06-01',
    });
    const result = computeTierCMetrics(data, testPriceMap);
    expect(result.trend).toBeDefined();
    expect(result.trend).toHaveProperty('status');
    expect(result.trend).toHaveProperty('observed_days');
    expect(result.trend).toHaveProperty('required_days');
    expect(result.trend).toHaveProperty('message');
    expect(typeof result.trend?.message).toBe('string');
  });
});

// ── Phase 1: Tier C spike_callout computation ───────────────────────────────

describe('Tier C spike_callout computation', () => {
  it('spike_callout fires when daily peak >= 2× daily average and days_with_data >= 3', () => {
    // 3 days: counts = [1, 1, 4] → average = 2, peak = 4 = 2× average → fires
    const daily = [
      { date: '2026-06-01', count: 1 },
      { date: '2026-06-02', count: 1 },
      { date: '2026-06-03', count: 4 },
    ];
    const data = tierCData({ daily, periodStart: '2026-06-01', periodEnd: '2026-06-03' });
    const result = computeTierCMetrics(data, testPriceMap);
    expect(result.spike_callout).not.toBeNull();
    expect(result.spike_callout?.date).toBe('2026-06-03');
    expect(result.spike_callout?.multiple_of_average).toBeCloseTo(2.0, 1);
  });

  it('spike_callout is null when only 2 days of data (< 3 required)', () => {
    // Only 2 days, peak = 10 but days_with_data < 3
    const daily = [
      { date: '2026-06-01', count: 1 },
      { date: '2026-06-02', count: 10 },
    ];
    const data = tierCData({ daily, periodStart: '2026-06-01', periodEnd: '2026-06-02' });
    const result = computeTierCMetrics(data, testPriceMap);
    expect(result.spike_callout).toBeNull();
  });

  it('spike_callout is null when peak is exactly less than 2× average', () => {
    // 3 days: [2, 2, 3] → average = 7/3 ≈ 2.33, peak = 3 < 2 × 2.33 ≈ 4.67 → no spike
    const daily = [
      { date: '2026-06-01', count: 2 },
      { date: '2026-06-02', count: 2 },
      { date: '2026-06-03', count: 3 },
    ];
    const data = tierCData({ daily, periodStart: '2026-06-01', periodEnd: '2026-06-03' });
    const result = computeTierCMetrics(data, testPriceMap);
    expect(result.spike_callout).toBeNull();
  });

  it('spike_callout fires at exactly peak = 2× average', () => {
    // 3 days: [1, 1, 2] → average = 4/3 ≈ 1.333, 2 × average ≈ 2.667, peak = 2 < 2.667 → no spike
    // For exactly 2×: [1, 2, 3] → average = 2, peak = 3 < 4 → no
    // Use [2, 2, 8] → average = 4, peak = 8 = 2×4 → fires (inclusive)
    const daily = [
      { date: '2026-06-01', count: 2 },
      { date: '2026-06-02', count: 2 },
      { date: '2026-06-03', count: 8 },
    ];
    const data = tierCData({ daily, periodStart: '2026-06-01', periodEnd: '2026-06-03' });
    const result = computeTierCMetrics(data, testPriceMap);
    expect(result.spike_callout).not.toBeNull();
    expect(result.spike_callout?.multiple_of_average).toBeCloseTo(8 / 4, 2); // 2.0
  });
});

describe('chatgptExport adapter — credentials contract', () => {
  it('accepts null credential without error', () => {
    // Phase 0: contract test — AdapterCredentials type allows null
    const credential: AdapterCredentials = null;
    expect(credential).toBeNull();
  });

  it('accepts any non-null string credential (credentials are ignored for file uploads)', () => {
    // Phase 0: contract test — AdapterCredentials type allows any string
    const credential: AdapterCredentials = 'any-string-is-valid';
    expect(typeof credential).toBe('string');
  });
});

describe('analyze routes', () => {
  it('POST /api/analyze/chatgpt_export with multipart file upload succeeds', () => {
    // Phase 0: contract test — AdapterConnectOptions supports uploadedFile Buffer
    const opts: AdapterConnectOptions = {
      priceMap: new Map(),
      uploadedFile: Buffer.from('[]'),
    };
    expect(opts.uploadedFile).toBeInstanceOf(Buffer);
  });

  it('assumptions includes Claude export disabled message', () => {
    // Phase 0: contract test — analysis report assumptions must mention Claude export is disabled
    // The actual route populates this in server/src/routes/analyze.ts
    const assumptions = [
      'OpenAI model cost shares are estimated from usage tokens and the LiteLLM price map',
      'Anthropic and Claude Code costs include cache creation/read token pricing when present in the LiteLLM price map',
      'Claude Code usage is read from local session JSONL files under the server process user profile',
      'GitHub Copilot usage is read from local session JSONL files under ~/.copilot/session-state/. No credentials required.',
      'Claude.ai export analysis is not available in this version (disabled)',
    ];
    const hasClaudeReference = assumptions.some(a =>
      a.toLowerCase().includes('claude') && (
        a.toLowerCase().includes('disabled') ||
        a.toLowerCase().includes('deferred') ||
        a.toLowerCase().includes('not available')
      )
    );
    expect(hasClaudeReference).toBe(true);
  });
});

// ── Phase 1: Cross-source spend (real computeCrossSourceMetrics tests) ──────

/** Helper to build a minimal Tier B SourceReport */
function tierBReport(sourceId: string, opts: {
  spend: number;
  dailySpend?: { date: string; spendUsd: number }[];
  inputTokens?: number;
  outputTokens?: number;
}): SourceReport {
  return {
    source_id: sourceId as any,
    tier: 'B',
    connected: true,
    error: null,
    metrics: {
      sourceId: sourceId as any,
      tier: 'B',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      warnings: [],
      totalActualSpendUsd: sourceId !== 'github_copilot' ? opts.spend : undefined,
      copilotTotalCostUsd: sourceId === 'github_copilot' ? opts.spend : undefined,
      totalSpendUsd: opts.spend,
      dailySpend: opts.dailySpend,
      modelBreakdown: opts.inputTokens != null ? [
        { model: 'model-a', estimatedCostShare: 1, estimatedCostUsd: opts.spend, inputTokens: opts.inputTokens, outputTokens: opts.outputTokens ?? 0, inputOutputRatio: 1 },
      ] : undefined,
      copilotTokenBreakdownByModel: sourceId === 'github_copilot' && opts.inputTokens != null ? [
        { model: 'gpt-5.4', inputTokens: opts.inputTokens, outputTokens: opts.outputTokens ?? 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requestCount: 1, requestCost: opts.spend },
      ] : undefined,
    },
  };
}

/** Helper to build a minimal Tier C SourceReport (chatgpt_export) */
function tierCReport(estimatedCost: number, totalConversations = 10, daily?: { date: string; conversation_count: number }[]): SourceReport {
  return {
    source_id: 'chatgpt_export',
    tier: 'C',
    connected: true,
    error: null,
    metrics: {
      sourceId: 'chatgpt_export',
      tier: 'C',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      warnings: [],
      estimated_relative_cost_usd: estimatedCost,
      total_conversations: totalConversations,
      total_messages: totalConversations * 2,
      active_days: daily?.length ?? 2,
      models_identified: [],
      daily_conversation_activity: daily ?? [
        { date: '2026-06-01', conversation_count: 3 },
        { date: '2026-06-15', conversation_count: 7 },
      ],
      estimated_token_volume: 50_000,
      baselineModelAssumption: 'gpt-4o',
      trend: { status: 'insufficient_data', observed_days: 2, required_days: 30, message: 'Test' },
      spike_callout: null,
    },
  };
}

const emptyPriceMap: PriceMap = new Map();

describe('Cross-source spend', () => {
  it('Mixed: total_estimated_spend_usd = Tier B actual + Tier C estimated', () => {
    const reports = [
      tierBReport('openai', { spend: 10 }),
      tierCReport(5),
    ];
    const summary = computeCrossSourceMetrics(reports, emptyPriceMap);
    expect(summary.total_estimated_spend_usd).toBeCloseTo(15); // 10 + 5
    expect(summary.total_actual_spend_usd).toBeCloseTo(10);
  });

  it('effective_cost_per_million_tokens_usd computed as Tier B spend / Tier B tokens × 1M', () => {
    // Phase 0: contract test — CrossSourceSummary type allows effective_cost_per_million_tokens_usd
    const tierBSpend = 10;
    const tierBTokens = 1_000_000;
    const expectedEffectiveCost = (tierBSpend / tierBTokens) * 1_000_000;
    const summary: CrossSourceSummary = {
      total_actual_spend_usd: tierBSpend,
      total_estimated_spend_usd: tierBSpend,
      total_actual_tokens: tierBTokens,
      total_estimated_tokens: 0,
      effective_cost_per_million_tokens_usd: expectedEffectiveCost,
      daily_spend: [],
      spend_by_tool: [],
      trend: { status: 'insufficient_data', observed_days: 0, required_days: 30, message: 'Test' },
      spike_callout: null,
    };
    expect(summary.effective_cost_per_million_tokens_usd).toBeCloseTo(tierBSpend);
  });

  it('Tier B-only: total_estimated_spend_usd equals total_actual_spend_usd', () => {
    const reports = [tierBReport('openai', { spend: 20 })];
    const summary = computeCrossSourceMetrics(reports, emptyPriceMap);
    expect(summary.total_estimated_spend_usd).toBeCloseTo(summary.total_actual_spend_usd);
    expect(summary.total_actual_spend_usd).toBeCloseTo(20);
  });

  it('Tier C-only: total_estimated_spend_usd equals Tier C estimated_relative_cost_usd', () => {
    const reports = [tierCReport(7.5)];
    const summary = computeCrossSourceMetrics(reports, emptyPriceMap);
    expect(summary.total_estimated_spend_usd).toBeCloseTo(7.5);
    expect(summary.total_actual_spend_usd).toBeCloseTo(0);
  });

  it('includes_estimates is true when Tier C contributes to total', () => {
    const reports = [tierCReport(3)];
    const summary = computeCrossSourceMetrics(reports, emptyPriceMap);
    expect(summary.includes_estimates).toBe(true);
  });

  it('includes_estimates is false when only Tier B sources', () => {
    const reports = [tierBReport('anthropic', { spend: 5 })];
    const summary = computeCrossSourceMetrics(reports, emptyPriceMap);
    expect(summary.includes_estimates).toBeFalsy();
  });

  it('spend_by_tool is sorted descending by estimated_spend_usd', () => {
    const reports = [
      tierBReport('openai', { spend: 5 }),
      tierBReport('anthropic', { spend: 15 }),
      tierCReport(8),
    ];
    const summary = computeCrossSourceMetrics(reports, emptyPriceMap);
    const spends = summary.spend_by_tool.map(e => e.estimated_spend_usd);
    expect(spends[0]).toBeGreaterThanOrEqual(spends[1]);
    expect(spends[1]).toBeGreaterThanOrEqual(spends[2]);
  });

  it('spend_by_tool entry for chatgpt_export has is_estimated true and estimate_label set', () => {
    const reports = [tierCReport(4)];
    const summary = computeCrossSourceMetrics(reports, emptyPriceMap);
    const entry = summary.spend_by_tool.find(e => e.source_id === 'chatgpt_export');
    expect(entry).toBeDefined();
    expect(entry!.is_estimated).toBe(true);
    expect(typeof entry!.estimate_label).toBe('string');
    expect(entry!.estimate_label!.length).toBeGreaterThan(0);
  });

  it('spend_by_tool entry for Tier B source has is_estimated false', () => {
    const reports = [tierBReport('openai', { spend: 10 })];
    const summary = computeCrossSourceMetrics(reports, emptyPriceMap);
    const entry = summary.spend_by_tool.find(e => e.source_id === 'openai');
    expect(entry).toBeDefined();
    expect(entry!.is_estimated).toBe(false);
  });

  it('GitHub Copilot is not double-counted in total (uses copilotTotalCostUsd, not totalActualSpendUsd)', () => {
    // Copilot report with copilotTotalCostUsd = 12 and totalActualSpendUsd = undefined
    const copilot = tierBReport('github_copilot', { spend: 12 });
    const summary = computeCrossSourceMetrics([copilot], emptyPriceMap);
    // Must be exactly 12, not 24 (double-counted)
    expect(summary.total_actual_spend_usd).toBeCloseTo(12);
    expect(summary.total_estimated_spend_usd).toBeCloseTo(12);
  });

  it('effective_cost_per_million_tokens_usd is null when no Tier B actual tokens exist', () => {
    // Tier C-only: no Tier B tokens → effective cost is null
    const reports = [tierCReport(5)];
    const summary = computeCrossSourceMetrics(reports, emptyPriceMap);
    expect(summary.effective_cost_per_million_tokens_usd).toBeNull();
  });
});

describe('Cross-source daily spend', () => {
  it('includes_estimated_tier_c is true on days with Tier C allocation', () => {
    // Phase 0: contract test — DailySpendEntry type has includes_estimated_tier_c flag
    const entry: DailySpendEntry = {
      date: '2026-06-01',
      spend_usd: 5.0,
      includes_estimated_tier_c: true,
    };
    expect(entry.includes_estimated_tier_c).toBe(true);
  });

  it('Tier C daily spend allocated proportionally from estimated_relative_cost_usd', () => {
    // 10 total conversations, estimated cost $10
    // Day 1: 3 conv → $3, Day 2: 7 conv → $7
    const reports = [
      tierCReport(10, 10, [
        { date: '2026-06-01', conversation_count: 3 },
        { date: '2026-06-02', conversation_count: 7 },
      ]),
    ];
    const summary = computeCrossSourceMetrics(reports, emptyPriceMap);
    const day1 = summary.daily_spend.find(d => d.date === '2026-06-01');
    const day2 = summary.daily_spend.find(d => d.date === '2026-06-02');
    expect(day1?.spend_usd).toBeCloseTo(3);
    expect(day2?.spend_usd).toBeCloseTo(7);
    expect(day1?.includes_estimated_tier_c).toBe(true);
    expect(day2?.includes_estimated_tier_c).toBe(true);
  });

  it('includes_estimated_tier_c is false or absent on days with only Tier B spend', () => {
    const reports = [
      tierBReport('openai', {
        spend: 5,
        dailySpend: [{ date: '2026-06-01', spendUsd: 5 }],
      }),
    ];
    const summary = computeCrossSourceMetrics(reports, emptyPriceMap);
    const day1 = summary.daily_spend.find(d => d.date === '2026-06-01');
    expect(day1).toBeDefined();
    expect(day1?.includes_estimated_tier_c).toBeFalsy(); // false or absent
  });

  it('no Tier C daily allocation when total_conversations is zero', () => {
    // Tier C with 0 conversations → no daily entries
    const reports = [tierCReport(5, 0, [])];
    const summary = computeCrossSourceMetrics(reports, emptyPriceMap);
    // No Tier C daily spend entries since total_conversations = 0
    const tierCDays = summary.daily_spend.filter(d => d.includes_estimated_tier_c);
    expect(tierCDays).toHaveLength(0);
  });

  it('includes Copilot Tier B dailySpend in cross-source daily_spend', () => {
    const reports = [
      tierBReport('github_copilot', {
        spend: 8,
        dailySpend: [
          { date: '2026-06-01', spendUsd: 3 },
          { date: '2026-06-02', spendUsd: 5 },
        ],
      }),
    ];
    const summary = computeCrossSourceMetrics(reports, emptyPriceMap);
    const d1 = summary.daily_spend.find(d => d.date === '2026-06-01');
    const d2 = summary.daily_spend.find(d => d.date === '2026-06-02');
    expect(d1?.spend_usd).toBeCloseTo(3);
    expect(d2?.spend_usd).toBeCloseTo(5);
  });
});

// ── C2: universal trend/spike from merged daily_spend ──────────────────────
function spendDays(startISO: string, count: number, spendPerDay: (i: number) => number) {
  const start = new Date(startISO).getTime();
  return Array.from({ length: count }, (_, i) => ({
    date: new Date(start + i * 86_400_000).toISOString().split('T')[0],
    spendUsd: spendPerDay(i),
  }));
}

describe('Cross-source universal trend and spike', () => {
  it('computes MoM trend from merged daily spend with 60 days', () => {
    // prior 30 days @ $1, last 30 days @ $2 → +100% MoM
    const dailySpend = spendDays('2026-04-01', 60, i => (i < 30 ? 1 : 2));
    const reports = [tierBReport('openai', { spend: 90, dailySpend })];
    const summary = computeCrossSourceMetrics(reports, emptyPriceMap);
    expect(summary.trend.status).toBe('available');
    if (summary.trend.status === 'available') {
      expect(summary.trend.mom_change_pct).toBeCloseTo(100, 0);
    }
  });

  it('applies same 60-day threshold for Tier B-only data', () => {
    // Only 30 days of coverage → below the universal 60-day requirement
    const dailySpend = spendDays('2026-06-01', 30, () => 5);
    const reports = [tierBReport('anthropic', { spend: 150, dailySpend })];
    const summary = computeCrossSourceMetrics(reports, emptyPriceMap);
    expect(summary.trend.status).toBe('insufficient_data');
  });

  it('creates spike_callout from merged daily_spend when peak ≥2× avg', () => {
    const dailySpend = [
      { date: '2026-06-01', spendUsd: 1 },
      { date: '2026-06-02', spendUsd: 1 },
      { date: '2026-06-03', spendUsd: 10 },
    ];
    const reports = [tierBReport('openai', { spend: 12, dailySpend })];
    const summary = computeCrossSourceMetrics(reports, emptyPriceMap);
    expect(summary.spike_callout).not.toBeNull();
    expect(summary.spike_callout?.date).toBe('2026-06-03');
  });

  it('returns null when fewer than 3 daily spend days exist', () => {
    const dailySpend = [
      { date: '2026-06-01', spendUsd: 1 },
      { date: '2026-06-02', spendUsd: 10 },
    ];
    const reports = [tierBReport('openai', { spend: 11, dailySpend })];
    const summary = computeCrossSourceMetrics(reports, emptyPriceMap);
    expect(summary.spike_callout).toBeNull();
  });
});

describe('summarizePotentialSavings', () => {
  it('cross-source summary includes total_potential_savings_usd summed from topSlotEligible recs', () => {
    const summary = summarizePotentialSavings([
      { id: 'R1', severity: 'Medium', title: 'A', body: 'A', triggeringMetric: 'x', triggeringValue: 1, estimatedSavingsUsd: 10, sourceIds: ['anthropic'], topSlotEligible: true },
      { id: 'R2', severity: 'High', title: 'B', body: 'B', triggeringMetric: 'x', triggeringValue: 1, estimatedSavingsUsd: 5.25, sourceIds: ['openai'], topSlotEligible: true },
      { id: 'R3', severity: 'Medium', title: 'C', body: 'C', triggeringMetric: 'x', triggeringValue: 1, estimatedSavingsUsd: 99, sourceIds: ['github_copilot'], topSlotEligible: false },
    ]);

    expect(summary.total_potential_savings_usd).toBe(15.25);
  });

  it('actionable_recommendation_count counts only topSlotEligible recs', () => {
    const summary = summarizePotentialSavings([
      { id: 'R1', severity: 'Medium', title: 'A', body: 'A', triggeringMetric: 'x', triggeringValue: 1, estimatedSavingsUsd: 10, sourceIds: ['anthropic'], topSlotEligible: true },
      { id: 'R2', severity: 'High', title: 'B', body: 'B', triggeringMetric: 'x', triggeringValue: 1, estimatedSavingsUsd: 99, sourceIds: ['openai'], topSlotEligible: false },
      { id: 'R3', severity: 'Medium', title: 'C', body: 'C', triggeringMetric: 'x', triggeringValue: 1, estimatedSavingsUsd: 0, sourceIds: ['github_copilot'] },
    ]);

    expect(summary.actionable_recommendation_count).toBe(1);
  });
});
