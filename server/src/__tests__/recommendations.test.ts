import { describe, expect, it } from 'vitest';
import type { PriceMap } from '../data/priceMap.js';
import { R1 } from '../engine/recommendations/R1_promptCaching.js';
import { R2 } from '../engine/recommendations/R2_modelDowngrade.js';
import { R3 } from '../engine/recommendations/R3_verbosity.js';
import { R4 } from '../engine/recommendations/R4_offPeak.js';
import type { RuleContext } from '../engine/recommendations/index.js';
import type { SourceMetrics } from '../types/index.js';

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
