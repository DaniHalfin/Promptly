import { describe, expect, it } from 'vitest';
import { transformReportForExport } from '../src/lib/exportTransform';
import type { AnalysisReport, SourceReport, SourceMetrics } from '../src/types/index.js';

const makeReport = (sources: SourceReport[]): AnalysisReport => ({
  metadata: {
    generated_at: '2026-06-22T12:00:00.000Z',
    analysis_period_start: '2026-05-23',
    analysis_period_end: '2026-06-22',
    promptly_version: '0.1.0',
    litellm_price_map_date: '2026-06-01',
  },
  sources,
  cross_source_summary: {
    total_actual_spend_usd: 100,
    total_estimated_spend_usd: 0,
    total_actual_tokens: 1000000,
    total_estimated_tokens: 0,
  },
  recommendations: [],
  assumptions: [],
});

const anthropicSource: SourceReport = {
  source_id: 'anthropic',
  tier: 'B',
  connected: true,
  error: null,
  metrics: {
    sourceId: 'anthropic',
    tier: 'B',
    periodStart: '2026-05-23',
    periodEnd: '2026-06-22',
    warnings: [],
    totalActualSpendUsd: 50,
  },
};

const copilotMetrics: SourceMetrics = {
  sourceId: 'github_copilot',
  tier: 'B',
  periodStart: '2026-05-23',
  periodEnd: '2026-06-22',
  warnings: ['test warning'],
  copilotTotalCostUsd: 85.25,
  copilotSessionCount: 89,
  copilotModelCostBreakdown: [
    { model: 'gpt-5.3-codex', costUsd: 55.41, costShare: 0.65 },
    { model: 'claude-sonnet-4.5', costUsd: 29.84, costShare: 0.35 },
  ],
  copilotTokenBreakdownByModel: [
    { model: 'gpt-5.3-codex', inputTokens: 1400000, outputTokens: 240000, cacheReadTokens: 420000, cacheWriteTokens: 110000, reasoningTokens: 0, requestCount: 1820, requestCost: 55.41 },
    { model: 'claude-sonnet-4.5', inputTokens: 750000, outputTokens: 140000, cacheReadTokens: 180000, cacheWriteTokens: 60000, reasoningTokens: 12000, requestCount: 940, requestCost: 29.84 },
  ],
  copilotCachedTokenFraction: {
    aggregate: 0.277,
    perModel: [
      { model: 'gpt-5.3-codex', fraction: 0.3 },
      { model: 'claude-sonnet-4.5', fraction: 0.24 },
    ],
  },
};

const copilotSource: SourceReport = {
  source_id: 'github_copilot',
  tier: 'B',
  connected: true,
  error: null,
  metrics: copilotMetrics,
};

describe('transformReportForExport', () => {
  it('passes non-Copilot source through unchanged', () => {
    const report = makeReport([anthropicSource]);
    const result = transformReportForExport(report) as { sources: unknown[] };
    expect(result.sources[0]).toStrictEqual(anthropicSource);
  });

  it('transforms Copilot metrics to snake_case keys', () => {
    const report = makeReport([copilotSource]);
    const result = transformReportForExport(report) as { sources: Array<{ metrics: Record<string, unknown> }> };
    const metrics = result.sources[0].metrics;

    expect(metrics).toHaveProperty('session_count', 89);
    expect(metrics).toHaveProperty('total_cost_usd', 85.25);
    expect(metrics).toHaveProperty('model_breakdown');
    expect(metrics).toHaveProperty('cached_token_fraction');
  });

  it('model_breakdown entries use snake_case keys', () => {
    const report = makeReport([copilotSource]);
    const result = transformReportForExport(report) as { sources: Array<{ metrics: { model_breakdown: Array<Record<string, unknown>> } }> };
    const breakdown = result.sources[0].metrics.model_breakdown;

    expect(breakdown).toHaveLength(2);
    const codexRow = breakdown.find(r => r.model === 'gpt-5.3-codex');
    expect(codexRow).toBeDefined();
    expect(codexRow).toHaveProperty('input_tokens', 1400000);
    expect(codexRow).toHaveProperty('output_tokens', 240000);
    expect(codexRow).toHaveProperty('cache_read_tokens', 420000);
    expect(codexRow).toHaveProperty('cache_write_tokens', 110000);
    expect(codexRow).toHaveProperty('reasoning_tokens', 0);
    expect(codexRow).toHaveProperty('request_count', 1820);
    expect(codexRow).toHaveProperty('request_cost', 55.41);
    expect(codexRow).toHaveProperty('cost_share', 0.65);
  });

  it('cached_token_fraction has aggregate and per_model', () => {
    const report = makeReport([copilotSource]);
    const result = transformReportForExport(report) as {
      sources: Array<{ metrics: { cached_token_fraction: { aggregate: number; per_model: Array<{ model: string; fraction: number }> } } }>
    };
    const frac = result.sources[0].metrics.cached_token_fraction;

    expect(frac.aggregate).toBeCloseTo(0.277);
    expect(frac.per_model).toHaveLength(2);
    expect(frac.per_model[0].model).toBe('gpt-5.3-codex');
    expect(frac.per_model[0].fraction).toBeCloseTo(0.3);
  });

  it('cached_token_fraction is undefined when absent from metrics', () => {
    const metricsNoCached: SourceMetrics = { ...copilotMetrics, copilotCachedTokenFraction: undefined };
    const source: SourceReport = { ...copilotSource, metrics: metricsNoCached };
    const report = makeReport([source]);
    const result = transformReportForExport(report) as {
      sources: Array<{ metrics: { cached_token_fraction: unknown } }>
    };
    expect(result.sources[0].metrics.cached_token_fraction).toBeUndefined();
  });

  it('does not expose camelCase Copilot fields in transformed output', () => {
    const report = makeReport([copilotSource]);
    const result = transformReportForExport(report) as { sources: Array<{ metrics: Record<string, unknown> }> };
    const metrics = result.sources[0].metrics;

    expect(metrics).not.toHaveProperty('copilotTotalCostUsd');
    expect(metrics).not.toHaveProperty('copilotTokenBreakdownByModel');
    expect(metrics).not.toHaveProperty('copilotModelCostBreakdown');
    expect(metrics).not.toHaveProperty('copilotCachedTokenFraction');
  });
});
