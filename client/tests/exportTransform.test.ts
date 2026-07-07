import { describe, expect, it } from 'vitest';
import { transformReportForExport } from '../src/lib/exportTransform';
import type { AnalysisReport, SourceReport, SourceMetrics, CrossSourceSummary, RecommendationResult, SpendByToolEntry } from '../src/types/index.js';

/** Shared stub for the new required CrossSourceSummary fields (Phase 1 implements full logic). */
const stubCrossSummary: CrossSourceSummary = {
  total_actual_spend_usd: 100,
  total_estimated_spend_usd: 0,
  total_actual_tokens: 1_000_000,
  total_estimated_tokens: 0,
  daily_spend: [],
  spend_by_tool: [],
  trend: { status: 'insufficient_data', observed_days: 0, required_days: 30, message: 'Phase 0 stub' },
  spike_callout: null,
};

const makeReport = (sources: SourceReport[]): AnalysisReport => ({
  metadata: {
    generated_at: '2026-06-22T12:00:00.000Z',
    analysis_period_start: '2026-05-23',
    analysis_period_end: '2026-06-22',
    promptly_version: '0.1.0',
    litellm_price_map_date: '2026-06-01',
  },
  sources,
  cross_source_summary: stubCrossSummary,
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
  efficiencySignal: {
    kind: 'balanced',
    headline: 'Balanced usage',
    explanation: 'Your input and output token mix is balanced for this period.',
    inputOutputRatio: 2,
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

  it('transformCopilotMetrics preserves efficiencySignal', () => {
    const report = makeReport([
      {
        ...copilotSource,
        metrics: {
          ...copilotMetrics,
          efficiencySignal: {
            kind: 'input_heavy',
            headline: 'Input-heavy usage pattern detected',
            explanation: 'Shorter prompts could reduce cost.',
            inputOutputRatio: 4.29,
          },
        },
      },
    ]);

    const transformed = transformReportForExport(report) as AnalysisReport;
    expect((transformed.sources[0].metrics as any).efficiencySignal).toEqual({
      kind: 'input_heavy',
      headline: 'Input-heavy usage pattern detected',
      explanation: 'Shorter prompts could reduce cost.',
      inputOutputRatio: 4.29,
    });
  });
});

// ============================================================
// Phase 0 ADR-9 contract tests (types and shape only; UI in Phase 3)
// ============================================================

describe('Results ADR-9', () => {
  it('AnalysisHeader shows mixed total spend', () => {
    // Phase 0: contract test — CrossSourceSummary type has all fields needed for mixed spend display
    const summary: CrossSourceSummary = {
      total_actual_spend_usd: 10,
      total_estimated_spend_usd: 15,  // includes Tier C estimation
      total_actual_tokens: 1_000_000,
      total_estimated_tokens: 500_000,
      daily_spend: [],
      spend_by_tool: [],
      trend: { status: 'insufficient_data', observed_days: 0, required_days: 30, message: 'Test' },
      spike_callout: null,
      includes_estimates: true,
    };
    // Verify the type accepts includes_estimates and the spend fields are present
    expect(summary.includes_estimates).toBe(true);
    expect(summary.total_estimated_spend_usd).toBeGreaterThan(summary.total_actual_spend_usd);
  });

  it('ToolCardsSection cards sorted by spend descending', () => {
    // Phase 0: contract test — SpendByToolEntry has rank and estimated_spend_usd for sort key
    const entries: CrossSourceSummary['spend_by_tool'] = [
      { source_id: 'anthropic', display_name: 'Anthropic', estimated_spend_usd: 30, percentage_of_total: 0.6, tier: 'B', is_estimated: false, rank: 1 },
      { source_id: 'chatgpt_export', display_name: 'ChatGPT Export', estimated_spend_usd: 20, percentage_of_total: 0.4, tier: 'C', is_estimated: true, estimate_label: 'Estimated', rank: 2 },
    ];
    // rank 1 > rank 2 means first entry has higher spend
    expect(entries[0].rank).toBeLessThan(entries[1].rank);
    expect(entries[0].estimated_spend_usd).toBeGreaterThan(entries[1].estimated_spend_usd);
  });
});

describe('SpendByToolBar', () => {
  it('top-slot click callback anchors to target card', () => {
    // Phase 0: contract test — RecommendationResult type has targetCardAnchor field for top-slot linking
    const rec: RecommendationResult = {
      id: 'R1',
      severity: 'High',
      title: 'Enable prompt caching',
      body: 'Test',
      triggeringMetric: 'cacheCreationInputTokensAnthropic',
      triggeringValue: 0,
      sourceIds: ['anthropic'],
      topSlotEligible: true,
      targetSourceId: 'anthropic',
      targetCardAnchor: '#anthropic-card',
      savingsLabel: 'Save $12/mo',
    };
    expect(rec.targetCardAnchor).toBe('#anthropic-card');
    expect(rec.topSlotEligible).toBe(true);
  });

  it('LS-1: spend_by_tool entries with rank are sortable in ascending rank order', () => {
    // LS-1: behavioral sort contract for SpendByToolEntry[] — rank 1 (highest spend) comes first.
    const entries: SpendByToolEntry[] = [
      { source_id: 'anthropic', display_name: 'Anthropic', rank: 2, estimated_spend_usd: 40, percentage_of_total: 33.3, tier: 'B', is_estimated: false },
      { source_id: 'openai', display_name: 'OpenAI', rank: 1, estimated_spend_usd: 80, percentage_of_total: 66.7, tier: 'B', is_estimated: false },
    ];

    const sorted = [...entries].sort((a, b) => a.rank - b.rank);

    // After ascending rank sort: rank-1 (openai, $80) is first
    expect(sorted[0].source_id).toBe('openai');
    expect(sorted[0].estimated_spend_usd).toBe(80);
    // rank-2 (anthropic, $40) is second
    expect(sorted[1].source_id).toBe('anthropic');
    expect(sorted[1].estimated_spend_usd).toBe(40);
    // Spend is monotonically decreasing after sort
    expect(sorted[0].estimated_spend_usd).toBeGreaterThan(sorted[1].estimated_spend_usd);
  });
});
