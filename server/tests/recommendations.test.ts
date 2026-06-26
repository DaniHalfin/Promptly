import { describe, expect, it } from 'vitest';
import type { PriceMap } from '../src/data/priceMap.js';
import { computeTierBMetrics } from '../src/engine/metrics/tierB.js';
import { R1 } from '../src/engine/recommendations/R1_promptCaching.js';
import { R2 } from '../src/engine/recommendations/R2_modelDowngrade.js';
import { R3 } from '../src/engine/recommendations/R3_verbosity.js';
import { R4 } from '../src/engine/recommendations/R4_offPeak.js';
import type { RuleContext } from '../src/engine/recommendations/index.js';
import type { NormalizedCopilotSession, SourceMetrics } from '../src/types/index.js';

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
      })]));

      expect(cards).toHaveLength(1);
      expect(cards[0]).toMatchObject({ id: 'R1', sourceIds: ['anthropic'], triggeringMetric: 'cacheCreationInputTokensAnthropic' });
    });

    it('fires Path B for Anthropic low cached-token fraction when cache creation is nonzero', () => {
      const cards = R1.evaluate(ctx([source({
        sourceId: 'anthropic',
        totalInputTokensAnthropic: 150_000,
        cacheCreationInputTokensAnthropic: 1,
        cachedTokenFractionAnthropic: 0.09,
      })]));

      expect(cards).toHaveLength(1);
      expect(cards[0].triggeringMetric).toBe('cachedTokenFractionAnthropic');
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
      })]));

      expect(cards).toHaveLength(1);
      expect(cards[0]).toMatchObject({ id: 'R1', sourceIds: ['claude_code'], triggeringMetric: 'cacheCreationInputTokensClaudeCode' });
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
    const copilot = (model: string, overrides: Partial<SourceMetrics> = {}) => source({
      sourceId: 'github_copilot',
      copilotNetSpendUsd: 10,
      copilotModelDistribution: [{ model, share: 0.5 }],
      copilotSpendByModel: [{ model, netAmountUsd: 10, netSpendUsd: 10, spendShare: 0.5 }],
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
      expect(R2.evaluate(ctx([copilot('gpt-5.4', { copilotNetSpendUsd: 4.99 })]))).toHaveLength(0);
    });

    it('does not fire when Copilot model share is below 0.30', () => {
      expect(R2.evaluate(ctx([copilot('gpt-5.4', { copilotModelDistribution: [{ model: 'gpt-5.4', share: 0.29 }] })]))).toHaveLength(0);
    });
  });

  describe('R2 Copilot branch — NormalizedCopilotSession-derived metrics', () => {
    /** Build a minimal session with the given model → cost mapping. */
    const makeSession = (
      models: Record<string, { requestCost: number }>,
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
            outputTokens: 50,
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

    it('recommendation body references the correct model names from copilotSpendByModel', () => {
      const metrics = metricsFromSessions([makeSession({ 'claude-opus-4-8': { requestCost: 12 } }, 12)]);
      const cards = R2.evaluate(ctx([metrics]));
      expect(cards[0].body).toContain('claude-opus-4-8');
      expect(cards[0].body).toContain('claude-haiku-4-5');
    });

    it('computes savings estimate when cheaper model also has spend in copilotSpendByModel', () => {
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
  });

  describe('R3 verbosity', () => {
    it('fires when p90 daily input tokens and input/output ratio exceed thresholds', () => {
      const cards = R3.evaluate(ctx([source({
        aggregateInputOutputRatio: 8.1,
        p90DailyInputTokens: 50_001,
      } as Partial<SourceMetrics>)]));

      expect(cards).toHaveLength(1);
    });

    it('does not fire when either threshold is not met', () => {
      expect(R3.evaluate(ctx([source({
        aggregateInputOutputRatio: 8,
        p90DailyInputTokens: 60_000,
      } as Partial<SourceMetrics>)]))).toHaveLength(0);
      expect(R3.evaluate(ctx([source({
        aggregateInputOutputRatio: 8.1,
        p90DailyInputTokens: 50_000,
      } as Partial<SourceMetrics>)]))).toHaveLength(0);
    });
  });

  describe('R4 off-peak', () => {
    const claudeCode = (overrides: Partial<SourceMetrics>) => source({
      sourceId: 'claude_code',
      claudeCodePeakHourFraction: 0.71,
      claudeCodeSessionCount: 20,
      periodStart: '2026-06-01T00:00:00Z',
      periodEnd: '2026-06-08T00:00:00Z',
      ...overrides,
    });

    it('fires when peak fraction, session count, and data window gates are met', () => {
      expect(R4.evaluate(ctx([claudeCode({})]))).toHaveLength(1);
    });

    it('does not fire when peak-hour fraction is undefined', () => {
      expect(R4.evaluate(ctx([claudeCode({ claudeCodePeakHourFraction: undefined })]))).toHaveLength(0);
    });

    it('does not fire when session count is below the gate', () => {
      expect(R4.evaluate(ctx([claudeCode({ claudeCodeSessionCount: 19 })]))).toHaveLength(0);
    });

    it('does not fire when peak-hour fraction is below threshold', () => {
      expect(R4.evaluate(ctx([claudeCode({ claudeCodePeakHourFraction: 0.69 })]))).toHaveLength(0);
    });
  });
});

