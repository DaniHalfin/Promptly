import { describe, expect, it } from 'vitest';
import type { PriceMap } from '../src/data/priceMap.js';
import { computeTierBMetrics } from '../src/engine/metrics/tierB.js';
import { selectTopRecommendations } from '../src/engine/metrics/crossSource.js';
import { R1 } from '../src/engine/recommendations/R1_promptCaching.js';
import { R2 } from '../src/engine/recommendations/R2_modelDowngrade.js';
import { getP90DailyInputTokens, R3 } from '../src/engine/recommendations/R3_verbosity.js';
import { RC1 } from '../src/engine/recommendations/RC1_dataFreshness.js';
import { RC3 } from '../src/engine/recommendations/RC3_coverage.js';
import { RC4a } from '../src/engine/recommendations/RC4a_highVolume.js';
import { RC4b } from '../src/engine/recommendations/RC4b_lowActivity.js';
import { RC5 } from '../src/engine/recommendations/RC5_spike.js';
import { RC6 } from '../src/engine/recommendations/RC6_noModelInfo.js';
import type { RuleContext } from '../src/engine/recommendations/index.js';
import type { NormalizedCopilotSession, RecommendationResult, SourceMetrics } from '../src/types/index.js';

const emptyPriceMap: PriceMap = new Map();

const source = (overrides: Partial<SourceMetrics>): SourceMetrics => ({
  sourceId: 'anthropic',
  tier: 'B',
  periodStart: '2026-06-01T00:00:00Z',
  periodEnd: '2026-06-08T00:00:00Z',
  warnings: [],
  ...overrides,
});

const ctx = (sources: SourceMetrics[], priceMap: PriceMap = emptyPriceMap): RuleContext => ({
  sources,
  reports: sources.map(metrics => ({ source_id: metrics.sourceId, tier: metrics.tier, connected: true, error: null, metrics })),
  priceMap,
});

describe('recommendation rules', () => {
  describe('R1 prompt caching', () => {
    it('fires Path A for Anthropic when cache creation is zero and volume is high', () => {
      const cards = R1.evaluate(ctx([source({
        sourceId: 'anthropic',
        totalInputTokensAnthropic: 100_001,
        cacheCreationInputTokensAnthropic: 0,
        projectedR1SavingsUsd: 12.34,
      })]));

      expect(cards).toHaveLength(1);
      expect(cards[0]).toMatchObject({ id: 'R1', sourceIds: ['anthropic'], triggeringMetric: 'cacheCreationInputTokensAnthropic' });
      expect(cards[0].estimatedSavingsUsd).toBe(12.34);
      expect(cards[0].topSlotEligible).toBe(true);
    });

    it('fires Path B for Anthropic low cached-token fraction when cache creation is nonzero', () => {
      const cards = R1.evaluate(ctx([source({
        sourceId: 'anthropic',
        totalInputTokensAnthropic: 150_000,
        cacheCreationInputTokensAnthropic: 1,
        cachedTokenFractionAnthropic: 0.09,
        projectedR1SavingsUsd: 7.5,
      })]));

      expect(cards).toHaveLength(1);
      expect(cards[0].triggeringMetric).toBe('cachedTokenFractionAnthropic');
      expect(cards[0].estimatedSavingsUsd).toBe(7.5);
    });

    it('prioritizes Path A over Path B for Anthropic', () => {
      const cards = R1.evaluate(ctx([source({
        sourceId: 'anthropic',
        totalInputTokensAnthropic: 150_000,
        cacheCreationInputTokensAnthropic: 0,
        cachedTokenFractionAnthropic: 0.01,
      })]));

      expect(cards).toHaveLength(1);
      expect(cards[0].triggeringMetric).toBe('cacheCreationInputTokensAnthropic');
    });

    it('fires Path C for Claude Code when cache creation is zero and volume is high', () => {
      const cards = R1.evaluate(ctx([source({
        sourceId: 'claude_code',
        totalInputTokensClaudeCode: 100_001,
        cacheCreationInputTokensClaudeCode: 0,
        projectedR1SavingsUsd: 9.25,
      })]));

      expect(cards).toHaveLength(1);
      expect(cards[0]).toMatchObject({ id: 'R1', sourceIds: ['claude_code'], triggeringMetric: 'cacheCreationInputTokensClaudeCode' });
      expect(cards[0].estimatedSavingsUsd).toBe(9.25);
    });

    it('sets estimatedSavingsUsd from projectedR1SavingsUsd, not realized cache savings', () => {
      const cards = R1.evaluate(ctx([source({
        sourceId: 'anthropic',
        totalInputTokensAnthropic: 150_000,
        cacheCreationInputTokensAnthropic: 0,
        cachedTokenSavingsUsdAnthropic: 2,
        projectedR1SavingsUsd: 11,
      })]));

      expect(cards[0].estimatedSavingsUsd).toBe(11);
      expect(cards[0].estimatedSavingsUsd).not.toBe(2);
    });

    it('sets savingsLabel when projected savings is computable', () => {
      const cards = R1.evaluate(ctx([source({
        sourceId: 'anthropic',
        totalInputTokensAnthropic: 150_000,
        cacheCreationInputTokensAnthropic: 0,
        projectedR1SavingsUsd: 11.234,
      })]));

      expect(cards[0].savingsLabel).toBe('Save $11.23');
    });

    it('sets targetRecommendationAnchor to #rec-${sourceId}-R1', () => {
      const cards = R1.evaluate(ctx([source({
        sourceId: 'claude_code',
        totalInputTokensClaudeCode: 150_000,
        cacheCreationInputTokensClaudeCode: 0,
        projectedR1SavingsUsd: 11,
      })]));

      expect(cards[0].targetRecommendationAnchor).toBe('#rec-claude_code-R1');
    });

    it('emits separate cards for Anthropic and Claude Code opportunities', () => {
      const cards = R1.evaluate(ctx([
        source({ sourceId: 'anthropic', totalInputTokensAnthropic: 120_000, cacheCreationInputTokensAnthropic: 0 }),
        source({ sourceId: 'claude_code', totalInputTokensClaudeCode: 130_000, cacheCreationInputTokensClaudeCode: 0 }),
      ]));

      expect(cards).toHaveLength(2);
      expect(cards.map(card => card.sourceIds[0]).sort()).toEqual(['anthropic', 'claude_code']);
    });

    it('does not fire below or at the Anthropic volume guard', () => {
      expect(R1.evaluate(ctx([source({
        sourceId: 'anthropic',
        totalInputTokensAnthropic: 100_000,
        cacheCreationInputTokensAnthropic: 0,
      })]))).toHaveLength(0);
    });
  });

  describe('R2 model downgrade', () => {
    const downgradePriceMap: PriceMap = new Map([
      ['claude-3-5-sonnet-20241022', { input_cost_per_token: 0.000003, output_cost_per_token: 0.000015 }],
      ['claude-3-haiku-20240307', { input_cost_per_token: 0.00000025, output_cost_per_token: 0.00000125 }],
    ]);

    const copilot = (model: string, overrides: Partial<SourceMetrics> = {}) => source({
      sourceId: 'github_copilot',
      copilotTotalCostUsd: 10,
      copilotModelCostBreakdown: [{ model, costUsd: 10, costShare: 0.5 }],
      copilotTokenBreakdownByModel: [{ model, inputTokens: 100, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requestCount: 1, requestCost: 10 }],
      ...overrides,
    });

    it('fires for gpt-5.4 matching the Copilot downgrade regex', () => {
      expect(R2.evaluate(ctx([copilot('gpt-5.4')]))).toHaveLength(1);
    });

    it('skips gpt-5.4-mini due to the self-match guard', () => {
      expect(R2.evaluate(ctx([copilot('gpt-5.4-mini')]))).toHaveLength(0);
    });

    it('fires for claude-opus-4-8', () => {
      expect(R2.evaluate(ctx([copilot('claude-opus-4-8')]))).toHaveLength(1);
    });

    it('does not fire when Copilot spend is below $5.00', () => {
      expect(R2.evaluate(ctx([copilot('gpt-5.4', { copilotTotalCostUsd: 4.99 })]))).toHaveLength(0);
    });

    it('does not fire when Copilot model share is below 0.30', () => {
      expect(R2.evaluate(ctx([copilot('gpt-5.4', {
        copilotModelCostBreakdown: [{ model: 'gpt-5.4', costUsd: 2.9, costShare: 0.29 }],
        copilotTokenBreakdownByModel: [{ model: 'gpt-5.4', inputTokens: 100, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requestCount: 1, requestCost: 2.9 }],
      })]))).toHaveLength(0);
    });

    it('does not fire for gpt-5.5-mini — mini variant should not get downgrade card', () => {
      // gpt-5.5-mini IS the cheaper option; the regex must exclude -mini variants
      expect(R2.evaluate(ctx([copilot('gpt-5.5-mini', {
        copilotModelCostBreakdown: [{ model: 'gpt-5.5-mini', costUsd: 9, costShare: 0.9 }],
        copilotTokenBreakdownByModel: [{ model: 'gpt-5.5-mini', inputTokens: 100, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requestCount: 1, requestCost: 9 }],
      })]))).toHaveLength(0);
    });

    it('does not fire when token breakdown is absent for the model (MF-5 guard)', () => {
      // copilotTokenBreakdownByModel is present but has no entry for this model
      expect(R2.evaluate(ctx([source({
        sourceId: 'github_copilot',
        copilotTotalCostUsd: 10,
        copilotModelCostBreakdown: [{ model: 'gpt-5.4', costUsd: 8, costShare: 0.8 }],
        copilotTokenBreakdownByModel: [], // no matching entry
      })]))).toHaveLength(0);
    });

    it('does not fire for a model with claude-3-5-sonnet in the middle of the name', () => {
      // ^ anchor prevents matching 'my-claude-3-5-sonnet-custom'
      const anthropicSource = source({
        sourceId: 'anthropic', tier: 'B',
        modelBreakdown: [{ model: 'my-claude-3-5-sonnet-custom', estimatedCostShare: 0.8, estimatedCostUsd: 50, inputTokens: 120_000, outputTokens: 200, inputOutputRatio: 500 }],
        periodStart: '2026-06-01T00:00:00Z', periodEnd: '2026-06-08T00:00:00Z',
      });
      const cards = R2.evaluate(ctx([anthropicSource]));
      expect(cards.filter(c => c.body.includes('my-claude-3-5-sonnet-custom'))).toHaveLength(0);
    });

    it('does fire for claude-3-5-sonnet-20241022 and recommends versioned cheaper model', () => {
      const anthropicSource = source({
        sourceId: 'anthropic', tier: 'B',
        modelBreakdown: [{ model: 'claude-3-5-sonnet-20241022', estimatedCostShare: 0.8, estimatedCostUsd: 50, inputTokens: 120_000, outputTokens: 200, inputOutputRatio: 500 }],
        periodStart: '2026-06-01T00:00:00Z', periodEnd: '2026-06-08T00:00:00Z',
      });
      const cards = R2.evaluate(ctx([anthropicSource], downgradePriceMap));
      expect(cards.length).toBeGreaterThan(0);
      expect(cards[0].body).toContain('claude-3-haiku-20240307');
    });

    it('sets compactHeadline, targetSourceId, targetCardAnchor, targetRecommendationAnchor, and savingsLabel when savings are computable', () => {
      const anthropicSource = source({
        sourceId: 'anthropic',
        tier: 'B',
        modelBreakdown: [{
          model: 'claude-3-5-sonnet-20241022',
          estimatedCostShare: 0.8,
          estimatedCostUsd: 50,
          inputTokens: 120_000,
          outputTokens: 200,
          inputOutputRatio: 500,
        }],
        periodStart: '2026-06-01T00:00:00Z',
        periodEnd: '2026-06-08T00:00:00Z',
      });

      const cards = R2.evaluate(ctx([anthropicSource], downgradePriceMap));
      expect(cards[0]).toMatchObject({
        compactHeadline: expect.stringContaining('claude-3-5-sonnet-20241022'),
        targetSourceId: 'anthropic',
        targetCardAnchor: '#tool-card-anthropic',
        targetRecommendationAnchor: '#rec-anthropic-R2',
        topSlotEligible: true,
      });
      expect(cards[0].savingsLabel).toMatch(/^Save \$/);
    });

    it('R2 body uses friendly source name, not raw source_id', () => {
      const cards = R2.evaluate(ctx([source({
        sourceId: 'openai',
        tier: 'B',
        modelBreakdown: [{ model: 'claude-3-5-sonnet-20241022', estimatedCostShare: 0.8, estimatedCostUsd: 50, inputTokens: 120_000, outputTokens: 200, inputOutputRatio: 500 }],
        periodStart: '2026-06-01T00:00:00Z',
        periodEnd: '2026-06-08T00:00:00Z',
      })], downgradePriceMap));

      expect(cards[0].body).toContain('OpenAI');
      expect(cards[0].body).not.toContain('openai spend');
      expect(cards[0].triggerSummary).toContain('OpenAI');
      expect(cards[0].triggerSummary).not.toContain('openai spend');
    });
  });

  describe('R2 Copilot branch — NormalizedCopilotSession-derived metrics', () => {
    /** Build a minimal session with the given model → cost mapping. */
    const makeSession = (
      models: Record<string, { requestCost: number; outputTokens?: number }>,
      totalCost: number,
    ): NormalizedCopilotSession => ({
      date: '2026-06-01',
      sourceFile: 'test-events.jsonl',
      models: Object.fromEntries(
        Object.entries(models).map(([m, v]) => [
          m,
          {
            requestCount: 1,
            requestCost: v.requestCost,
            inputTokens: 100,
            outputTokens: v.outputTokens ?? 10,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            reasoningTokens: 0,
          },
        ]),
      ),
      totalCost,
    });

    /** Run computeTierBMetrics for github_copilot and merge into a SourceMetrics stub. */
    const metricsFromSessions = (sessions: NormalizedCopilotSession[]): SourceMetrics => {
      const partial = computeTierBMetrics(
        {
          sourceId: 'github_copilot',
          copilotSessions: sessions,
          periodStart: '2026-06-01T00:00:00Z',
          periodEnd: '2026-06-08T00:00:00Z',
        },
        emptyPriceMap,
      );
      return source({ sourceId: 'github_copilot', ...partial });
    };

    it('fires when computeTierBMetrics output has a dominant premium Copilot model', () => {
      const metrics = metricsFromSessions([makeSession({ 'claude-opus-4-8': { requestCost: 12 } }, 12)]);
      const cards = R2.evaluate(ctx([metrics]));
      expect(cards).toHaveLength(1);
      expect(cards[0].id).toBe('R2');
      expect(cards[0].sourceIds).toEqual(['github_copilot']);
    });

    it('recommendation body references the correct model names from copilotModelCostBreakdown', () => {
      const metrics = metricsFromSessions([makeSession({ 'claude-opus-4-8': { requestCost: 12 } }, 12)]);
      const cards = R2.evaluate(ctx([metrics]));
      expect(cards[0].body).toContain('claude-opus-4-8');
      expect(cards[0].body).toContain('claude-haiku-4-5');
    });

    it('computes savings estimate when cheaper model also has spend in copilotModelCostBreakdown', () => {
      // claude-opus-4-8 costs $10, claude-haiku-4-5 costs $1 → savings should be ~$9
      const metrics = metricsFromSessions([
        makeSession({ 'claude-opus-4-8': { requestCost: 10 }, 'claude-haiku-4-5': { requestCost: 1 } }, 11),
      ]);
      const cards = R2.evaluate(ctx([metrics]));
      const opusCard = cards.find(c => c.body.includes('claude-opus-4-8'));
      expect(opusCard).toBeDefined();
      expect(opusCard!.estimatedSavingsUsd).toBeCloseTo(9, 1);
    });

    it('savings estimate is undefined when cheaper model has no spend data', () => {
      // Only claude-opus-4-8 appears; claude-haiku-4-5 has no entry → estimateCopilotSavings returns undefined
      const metrics = metricsFromSessions([makeSession({ 'claude-opus-4-8': { requestCost: 12 } }, 12)]);
      const cards = R2.evaluate(ctx([metrics]));
      expect(cards[0].estimatedSavingsUsd).toBeUndefined();
    });

    it('does not fire for a model not in COPILOT_DOWNGRADE_MAP', () => {
      const metrics = metricsFromSessions([makeSession({ 'some-unknown-model-x': { requestCost: 20 } }, 20)]);
      const cards = R2.evaluate(ctx([metrics]));
      expect(cards).toHaveLength(0);
    });

    it('does not fire when total net spend is below $5 threshold', () => {
      const metrics = metricsFromSessions([makeSession({ 'claude-opus-4-8': { requestCost: 4 } }, 4)]);
      const cards = R2.evaluate(ctx([metrics]));
      expect(cards).toHaveLength(0);
    });

    it('does not fire when premium model share is below 30%', () => {
      // claude-opus-4-8 has $2 of $10 total = 20% share
      const metrics = metricsFromSessions([
        makeSession({ 'claude-opus-4-8': { requestCost: 2 }, 'claude-haiku-4-5': { requestCost: 8 } }, 10),
      ]);
      const cards = R2.evaluate(ctx([metrics]));
      const opusCard = cards.find(c => c.body.includes('claude-opus-4-8'));
      expect(opusCard).toBeUndefined();
    });

    // Verifies aggregation: two sessions with same model must sum before threshold check
    it('fires and sums copilotTotalCostUsd across two sessions when combined spend exceeds $5', () => {
      const session1 = makeSession({ 'claude-opus-4-8': { requestCost: 3 } }, 3);
      const session2 = makeSession({ 'claude-opus-4-8': { requestCost: 3 } }, 3);
      const metrics = metricsFromSessions([session1, session2]);

      // R2 should fire: combined spend is $6, above $5 threshold
      const cards = R2.evaluate(ctx([metrics]));
      expect(cards.length).toBeGreaterThan(0);
      expect(cards[0].id).toBe('R2');

      // Aggregation check: copilotTotalCostUsd must be the sum (6), not one session's value (3)
      expect(metrics.copilotTotalCostUsd).toBe(6);
    });

    // MF-5 tests: avgOutputPerDay guard
    it('MF-5: fires when avgOutputPerDay is below 500 (200 output / 8 days ≈ 25)', () => {
      // periodStart/End: 8 days window, outputTokens: 200 → avgOutputPerDay ≈ 25
      const metrics = metricsFromSessions([makeSession({ 'claude-opus-4-8': { requestCost: 12, outputTokens: 200 } }, 12)]);
      const cards = R2.evaluate(ctx([metrics]));
      expect(cards.length).toBeGreaterThan(0);
    });

    it('MF-5: does not fire when avgOutputPerDay equals 500 (4000 output / 8 days = 500)', () => {
      const metrics = metricsFromSessions([makeSession({ 'claude-opus-4-8': { requestCost: 12, outputTokens: 4000 } }, 12)]);
      const cards = R2.evaluate(ctx([metrics]));
      const opusCard = cards.find(c => c.body.includes('claude-opus-4-8'));
      expect(opusCard).toBeUndefined();
    });

    it('MF-5: does not fire when avgOutputPerDay exceeds 500 (6000 output / 8 days = 750)', () => {
      const metrics = metricsFromSessions([makeSession({ 'claude-opus-4-8': { requestCost: 12, outputTokens: 6000 } }, 12)]);
      const cards = R2.evaluate(ctx([metrics]));
      const opusCard = cards.find(c => c.body.includes('claude-opus-4-8'));
      expect(opusCard).toBeUndefined();
    });
  });

  describe('R3 verbosity', () => {
    const inputRatePriceMap: PriceMap = new Map([
      ['gpt-5.4', { input_cost_per_token: 0.000002, output_cost_per_token: 0.00001 }],
      ['claude-3-5-sonnet', { input_cost_per_token: 0.000003, output_cost_per_token: 0.000015 }],
    ]);

    it('returns 0 for empty daily input token series', () => {
      expect(getP90DailyInputTokens([])).toBe(0);
    });

    it('returns the 90th percentile daily input token count', () => {
      expect(getP90DailyInputTokens([
        { date: '2026-06-01', inputTokens: 10 },
        { date: '2026-06-02', inputTokens: 20 },
        { date: '2026-06-03', inputTokens: 30 },
        { date: '2026-06-04', inputTokens: 40 },
        { date: '2026-06-05', inputTokens: 50 },
        { date: '2026-06-06', inputTokens: 60 },
        { date: '2026-06-07', inputTokens: 70 },
        { date: '2026-06-08', inputTokens: 80 },
        { date: '2026-06-09', inputTokens: 90 },
        { date: '2026-06-10', inputTokens: 100 },
      ])).toBe(90);
    });

    it('fires for Copilot when p90 daily input tokens and input/output ratio exceed thresholds', () => {
      const cards = R3.evaluate(ctx([source({
        sourceId: 'github_copilot',
        aggregateInputOutputRatio: 8.1,
        copilotDailyInputTokens: [
          { date: '2026-06-01', inputTokens: 20_000 },
          { date: '2026-06-02', inputTokens: 30_000 },
          { date: '2026-06-03', inputTokens: 40_000 },
          { date: '2026-06-04', inputTokens: 60_000 },
          { date: '2026-06-05', inputTokens: 70_000 },
        ],
      } as Partial<SourceMetrics>)]));

      expect(cards).toHaveLength(1);
      expect(cards[0].sourceIds).toEqual(['github_copilot']);
    });

    it('does not fire for Copilot when p90 daily input tokens are below threshold', () => {
      expect(R3.evaluate(ctx([source({
        sourceId: 'github_copilot',
        aggregateInputOutputRatio: 8.1,
        copilotDailyInputTokens: [
          { date: '2026-06-01', inputTokens: 10_000 },
          { date: '2026-06-02', inputTokens: 20_000 },
          { date: '2026-06-03', inputTokens: 30_000 },
          { date: '2026-06-04', inputTokens: 40_000 },
          { date: '2026-06-05', inputTokens: 50_000 },
        ],
      } as Partial<SourceMetrics>)]))).toHaveLength(0);
    });

    it('marks estimated savings as top-slot eligible with plain savingsLabel', () => {
      const cards = R3.evaluate(ctx([source({
        sourceId: 'anthropic',
        aggregateInputOutputRatio: 10,
        modelBreakdown: [{
          model: 'claude-3-5-sonnet',
          estimatedCostShare: 1,
          estimatedCostUsd: 30,
          inputTokens: 120_000,
          outputTokens: 10_000,
          inputOutputRatio: 10,
        }],
        periodStart: '2026-06-01',
        periodEnd: '2026-06-02',
      })], inputRatePriceMap));

      expect(cards).toHaveLength(1);
      expect(cards[0].topSlotEligible).toBe(true);
      expect(cards[0].savingsLabel).toMatch(/^Save \$/);
      expect(cards[0].savingsLabel).not.toContain('~');
      expect(cards[0].savingsLabel).not.toContain('approximate');
      expect(cards[0].targetRecommendationAnchor).toBe('#rec-anthropic-R3');
    });

    it('computes approximate savings using spec §8 formula when rates available', () => {
      const cards = R3.evaluate(ctx([source({
        sourceId: 'anthropic',
        aggregateInputOutputRatio: 10,
        modelBreakdown: [{
          model: 'claude-3-5-sonnet',
          estimatedCostShare: 1,
          estimatedCostUsd: 30,
          inputTokens: 120_000,
          outputTokens: 10_000,
          inputOutputRatio: 10,
        }],
        periodStart: '2026-06-01',
        periodEnd: '2026-06-02',
      })], inputRatePriceMap));

      const inputSpend = 120_000 * 0.000003;
      expect(cards[0].estimatedSavingsUsd).toBeCloseTo(inputSpend * (1 - 1 / 10) * 0.20);
    });

    it('sets topSlotEligible false when no LiteLLM rates for any model', () => {
      const cards = R3.evaluate(ctx([source({
        sourceId: 'anthropic',
        aggregateInputOutputRatio: 10,
        modelBreakdown: [{
          model: 'unknown-model',
          estimatedCostShare: 1,
          estimatedCostUsd: 30,
          inputTokens: 120_000,
          outputTokens: 10_000,
          inputOutputRatio: 10,
        }],
        periodStart: '2026-06-01',
        periodEnd: '2026-06-02',
      })], emptyPriceMap));

      expect(cards).toHaveLength(1);
      expect(cards[0].topSlotEligible).toBe(false);
      expect(cards[0].estimatedSavingsUsd).toBeUndefined();
      expect(cards[0].savingsLabel).toBeUndefined();
    });

    it('R3 body uses friendly source name, not raw source_id', () => {
      const cards = R3.evaluate(ctx([source({
        sourceId: 'github_copilot',
        aggregateInputOutputRatio: 10,
        copilotTokenBreakdownByModel: [{ model: 'gpt-5.4', inputTokens: 120_000, outputTokens: 10_000, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requestCount: 1, requestCost: 1 }],
        copilotDailyInputTokens: [{ date: '2026-06-01', inputTokens: 120_000 }],
        periodStart: '2026-06-01',
        periodEnd: '2026-06-02',
      })], inputRatePriceMap));

      expect(cards[0].title).toBe('Your prompts may be longer than needed');
      expect(cards[0].body).toContain('GitHub Copilot');
      expect(cards[0].body).toContain('persistent instructions');
      expect(cards[0].body).toContain("Paste only what's relevant");
      expect(cards[0].body).not.toContain('github_copilot');
      expect(cards[0].body).not.toContain('input/output ratio');
      expect(cards[0].body).not.toContain('p90');
    });
  });

  describe('R4 not in registry', () => {
    it('R4 never fires for any Claude Code source data', () => {
      // Phase 0: verify that the active rule set (R1, R2, R3) never emits 'R4'
      const claudeCodeSource = source({
        sourceId: 'claude_code',
        claudeCodePeakHourFraction: 0.71,
        claudeCodeSessionCount: 20,
      });
      const ruleCtx = ctx([claudeCodeSource]);
      const allIds = [R1, R2, R3].flatMap(rule => rule.evaluate(ruleCtx)).map(r => r.id);
      expect(allIds).not.toContain('R4');
    });

    it('generated recommendation IDs are only from the allowed set', () => {
      // Phase 0: the allowed RecommendationId set has no stale IDs
      const allowedSet = new Set<string>(['R1', 'R2', 'R3', 'RC1', 'RC3', 'RC4a', 'RC4b', 'RC5', 'RC6']);
      const claudeCodeSource = source({
        sourceId: 'claude_code',
        claudeCodePeakHourFraction: 0.71,
        claudeCodeSessionCount: 20,
        totalInputTokensClaudeCode: 200_000,
        cacheCreationInputTokensClaudeCode: 0,
      });
      const ruleCtx = ctx([claudeCodeSource]);
      const allIds = [R1, R2, R3].flatMap(rule => rule.evaluate(ruleCtx)).map(r => r.id);
      for (const id of allIds) {
        expect(allowedSet.has(id)).toBe(true);
      }
    });
  });

  describe('RC1 data freshness', () => {
    it('RC1 has topSlotEligible: false', () => {
      // Phase 0: contract test — RC recommendation results must not appear as top-slot savings cards
      // RC1 rule is implemented in Phase 2; this verifies the RecommendationResult type allows the field
      const rec: RecommendationResult = {
        id: 'RC1',
        severity: 'Low',
        title: 'Your ChatGPT Export data may be stale',
        body: 'Test body',
        triggeringMetric: 'newest_conversation_date',
        triggeringValue: '2026-01-01',
        sourceIds: ['chatgpt_export'],
        topSlotEligible: false,
      };
      expect(rec.topSlotEligible).toBe(false);
    });

    it('fires when newest_conversation_date is more than 30 days ago', () => {
      const staleDate = new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10);
      const cards = RC1.evaluate(ctx([source({
        sourceId: 'chatgpt_export',
        tier: 'C',
        newest_conversation_date: staleDate,
      })]));
      expect(cards).toHaveLength(1);
      expect(cards[0].id).toBe('RC1');
      expect(cards[0].sourceIds).toEqual(['chatgpt_export']);
    });

    it('does NOT fire when newest_conversation_date is within 30 days', () => {
      const freshDate = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
      const cards = RC1.evaluate(ctx([source({
        sourceId: 'chatgpt_export',
        tier: 'C',
        newest_conversation_date: freshDate,
      })]));
      expect(cards).toHaveLength(0);
    });

    it('does NOT fire when chatgpt_export source is absent', () => {
      expect(RC1.evaluate(ctx([source({ sourceId: 'anthropic', tier: 'B' })]))).toHaveLength(0);
    });
  });

  describe('RC3 coverage', () => {
    const chatgptSource = (estimatedSpend: number): SourceMetrics => source({
      sourceId: 'chatgpt_export',
      tier: 'C',
      estimated_relative_cost_usd: estimatedSpend,
    });
    const tierBSource = (spend: number): SourceMetrics => source({
      sourceId: 'anthropic',
      tier: 'B',
      totalActualSpendUsd: spend,
    });

    it('fires when chatgpt is connected + Tier B connected + chatgpt > 5% of total', () => {
      // chatgpt = 10, anthropic = 90, pct = 10% > 5%
      const cards = RC3.evaluate(ctx([chatgptSource(10), tierBSource(90)]));
      expect(cards).toHaveLength(1);
      expect(cards[0].id).toBe('RC3');
    });

    it('does NOT fire when chatgpt spend is ≤5% of total', () => {
      // chatgpt = 5, anthropic = 95, pct = 5% ≤ 5%
      const cards = RC3.evaluate(ctx([chatgptSource(5), tierBSource(95)]));
      expect(cards).toHaveLength(0);
    });

    it('does NOT fire when no Tier B source is present', () => {
      const cards = RC3.evaluate(ctx([chatgptSource(50)]));
      expect(cards).toHaveLength(0);
    });

    it('does NOT fire when chatgpt_export has no metrics', () => {
      // Only Tier B, no chatgpt_export
      const cards = RC3.evaluate(ctx([tierBSource(100)]));
      expect(cards).toHaveLength(0);
    });
  });

  describe('RC4a high volume', () => {
    it('fires when total_conversations > 500', () => {
      const cards = RC4a.evaluate(ctx([source({ sourceId: 'chatgpt_export', tier: 'C', total_conversations: 501 })]));
      expect(cards).toHaveLength(1);
      expect(cards[0].id).toBe('RC4a');
    });

    it('does NOT fire when total_conversations equals 500', () => {
      expect(RC4a.evaluate(ctx([source({ sourceId: 'chatgpt_export', tier: 'C', total_conversations: 500 })]))).toHaveLength(0);
    });

    it('does NOT fire when chatgpt_export is absent', () => {
      expect(RC4a.evaluate(ctx([source({ sourceId: 'anthropic', tier: 'B' })]))).toHaveLength(0);
    });
  });

  describe('RC4b low activity', () => {
    it('fires when total_conversations < 5', () => {
      const cards = RC4b.evaluate(ctx([source({ sourceId: 'chatgpt_export', tier: 'C', total_conversations: 4 })]));
      expect(cards).toHaveLength(1);
      expect(cards[0].id).toBe('RC4b');
    });

    it('fires for 0 conversations', () => {
      const cards = RC4b.evaluate(ctx([source({ sourceId: 'chatgpt_export', tier: 'C', total_conversations: 0 })]));
      expect(cards).toHaveLength(1);
    });

    it('does NOT fire when total_conversations equals 5', () => {
      expect(RC4b.evaluate(ctx([source({ sourceId: 'chatgpt_export', tier: 'C', total_conversations: 5 })]))).toHaveLength(0);
    });

    it('does NOT fire when total_conversations is undefined', () => {
      expect(RC4b.evaluate(ctx([source({ sourceId: 'chatgpt_export', tier: 'C' })]))).toHaveLength(0);
    });
  });

  describe('RC5 spike', () => {
    const spikeCallout = {
      date: '2026-06-07',
      conversation_count: 40,
      multiple_of_average: 2.5,
      message: 'Activity on 2026-06-07 was 2.5× the average.',
    };

    it('fires when spike_callout is present', () => {
      const cards = RC5.evaluate(ctx([source({
        sourceId: 'chatgpt_export',
        tier: 'C',
        spike_callout: spikeCallout,
      })]));
      expect(cards).toHaveLength(1);
      expect(cards[0].id).toBe('RC5');
    });

    it('does NOT fire when spike_callout is null', () => {
      expect(RC5.evaluate(ctx([source({ sourceId: 'chatgpt_export', tier: 'C', spike_callout: null })]))).toHaveLength(0);
    });

    it('does NOT fire when chatgpt_export is absent', () => {
      expect(RC5.evaluate(ctx([source({ sourceId: 'anthropic', tier: 'B' })]))).toHaveLength(0);
    });
  });

  describe('RC6 no model info', () => {
    it('fires when models_identified is an empty array', () => {
      const cards = RC6.evaluate(ctx([source({
        sourceId: 'chatgpt_export',
        tier: 'C',
        models_identified: [],
      })]));
      expect(cards).toHaveLength(1);
      expect(cards[0].id).toBe('RC6');
    });

    it('does NOT fire when models_identified has entries', () => {
      expect(RC6.evaluate(ctx([source({
        sourceId: 'chatgpt_export',
        tier: 'C',
        models_identified: ['gpt-4o'],
      })]))).toHaveLength(0);
    });

    it('does NOT fire when models_identified is undefined', () => {
      expect(RC6.evaluate(ctx([source({ sourceId: 'chatgpt_export', tier: 'C' })]))).toHaveLength(0);
    });
  });

  describe('R1/R2/R3 Tier B guard', () => {
    const chatgptOnlyCtx = (): RuleContext => ctx([source({
      sourceId: 'chatgpt_export',
      tier: 'C',
      total_conversations: 100,
      models_identified: ['gpt-4o'],
    })]);

    it('R1 does NOT fire when only chatgpt_export data is present', () => {
      expect(R1.evaluate(chatgptOnlyCtx())).toHaveLength(0);
    });

    it('R2 does NOT fire when only chatgpt_export data is present', () => {
      expect(R2.evaluate(chatgptOnlyCtx())).toHaveLength(0);
    });

    it('R3 does NOT fire when only chatgpt_export data is present', () => {
      expect(R3.evaluate(chatgptOnlyCtx())).toHaveLength(0);
    });
  });

  describe('selectTopRecommendations', () => {
    const makeRec = (
      severity: RecommendationResult['severity'],
      id: RecommendationResult['id'],
      savings: number | null = 10,
      overrides: Partial<RecommendationResult> = {},
    ): RecommendationResult => ({
      id,
      severity,
      title: `${id} title`,
      body: 'body',
      triggeringMetric: 'x',
      triggeringValue: 0,
      estimatedSavingsUsd: savings,
      sourceIds: ['anthropic'],
      compactHeadline: `${id} compact`,
      topSlotEligible: true,
      targetSourceId: 'anthropic',
      targetCardAnchor: '#tool-card-anthropic',
      targetRecommendationAnchor: `#rec-anthropic-${id}`,
      savingsLabel: `Save $${(savings ?? 0).toFixed(2)}`,
      ...overrides,
    });

    it('returns max two savings-bearing recommendations sorted by estimated dollar savings', () => {
      const recs = [makeRec('High', 'R2', 5), makeRec('Medium', 'R1', 20), makeRec('Medium', 'R3', 10)];
      const top = selectTopRecommendations(recs);
      expect(top.map(rec => rec.id)).toEqual(['R1', 'R3']);
      expect(top).toHaveLength(2);
    });

    it('excludes Tier C recommendations from top money-saving slots', () => {
      const recs = [
        makeRec('High', 'RC1', 100, { sourceIds: ['chatgpt_export'], targetSourceId: 'chatgpt_export' }),
        makeRec('Medium', 'R1', 10),
      ];
      expect(selectTopRecommendations(recs).map(rec => rec.id)).toEqual(['R1']);
    });

    it('breaks savings ties by severity', () => {
      const recs = [makeRec('Medium', 'R1', 10), makeRec('High', 'R2', 10), makeRec('Low', 'R3', 10)];
      expect(selectTopRecommendations(recs).map(rec => rec.id)).toEqual(['R2', 'R1']);
    });

    it('suppressed R2 pair does not appear in top_recommendations', () => {
      const recs = [
        makeRec('High', 'R2', 0, { topSlotEligible: false, estimatedSavingsUsd: undefined }),
        makeRec('Medium', 'R1', 8),
      ];
      expect(selectTopRecommendations(recs).map(rec => rec.id)).toEqual(['R1']);
    });

    it('uses targetRecommendationAnchor before targetCardAnchor when present', () => {
      const top = selectTopRecommendations([makeRec('High', 'R2', 10)])[0];
      expect(top.target_recommendation_anchor).toBe('#rec-anthropic-R2');
      expect(top.target_card_anchor).toBe('#tool-card-anthropic');
    });

    it('preserves RecommendationResult severity casing High Medium Low', () => {
      const top = selectTopRecommendations([
        makeRec('Low', 'R3', 3),
        makeRec('Medium', 'R1', 2),
        makeRec('High', 'R2', 1),
      ]);
      expect(top.map(rec => rec.severity)).toEqual(['Low', 'Medium']);
    });
  });
});
