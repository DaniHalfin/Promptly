import { RecommendationResult, SourceId, SourceMetrics } from '../../types/index.js';
import type { Rule, RuleContext } from './index.js';

const MIN_INPUT_TOKENS = 100_000;
const LOW_CACHE_FRACTION = 0.1;

/** Guard: R1 only fires when at least one Tier B source has data. */
function hasTierBSource(ctx: RuleContext): boolean {
  return ctx.sources.some(s => s.tier === 'B');
}

export const R1: Rule = {
  id: 'R1',
  severity: 'Medium',
  evaluate(ctx: RuleContext): RecommendationResult[] {
    if (!hasTierBSource(ctx)) return [];
    const cards: RecommendationResult[] = [];

    const anthropic = ctx.sources.find(source => source.sourceId === 'anthropic');
    if (anthropic && (anthropic.totalInputTokensAnthropic ?? 0) > MIN_INPUT_TOKENS) {
      const noCacheCreation = anthropic.cacheCreationInputTokensAnthropic === 0;
      const lowCacheFraction =
        !noCacheCreation &&
        anthropic.cachedTokenFractionAnthropic !== undefined &&
        anthropic.cachedTokenFractionAnthropic < LOW_CACHE_FRACTION;

      if (noCacheCreation) {
        cards.push(buildR1Card('anthropic', 'Anthropic', anthropic, 'cacheCreationInputTokensAnthropic', 0));
      } else if (lowCacheFraction) {
        cards.push(
          buildR1Card(
            'anthropic',
            'Anthropic',
            anthropic,
            'cachedTokenFractionAnthropic',
            `${((anthropic.cachedTokenFractionAnthropic ?? 0) * 100).toFixed(1)}%`
          )
        );
      }
    }

    const claudeCode = ctx.sources.find(source => source.sourceId === 'claude_code');
    if (claudeCode && (claudeCode.totalInputTokensClaudeCode ?? 0) > MIN_INPUT_TOKENS) {
      const noCacheCreation = claudeCode.cacheCreationInputTokensClaudeCode === 0;
      const lowCacheFraction =
        claudeCode.cachedTokenFractionClaudeCode !== undefined &&
        claudeCode.cachedTokenFractionClaudeCode < LOW_CACHE_FRACTION;

      if (noCacheCreation || lowCacheFraction) {
        cards.push(
          buildR1Card(
            'claude_code',
            'Claude Code',
            claudeCode,
            noCacheCreation ? 'cacheCreationInputTokensClaudeCode' : 'cachedTokenFractionClaudeCode',
            noCacheCreation ? 0 : `${((claudeCode.cachedTokenFractionClaudeCode ?? 0) * 100).toFixed(1)}%`
          )
        );
      }
    }

    return cards;
  },
};

function buildR1Card(
  sourceId: SourceId,
  sourceName: string,
  metrics: SourceMetrics,
  triggeringMetric: string,
  triggeringValue: number | string
): RecommendationResult {
  const totalInputTokens =
    sourceId === 'anthropic' ? metrics.totalInputTokensAnthropic ?? 0 : metrics.totalInputTokensClaudeCode ?? 0;
  const savings = metrics.projectedR1SavingsUsd;
  const hasSavings = savings != null && savings > 0;

  return {
    id: 'R1',
    severity: 'Medium',
    title: `${sourceName} prompt caching opportunity`,
    body:
      `${sourceName} processed ${Math.round(totalInputTokens).toLocaleString()} input tokens with little or no prompt cache reuse. ` +
      'Enable cache writes for reusable prompts and tool/context prefixes so repeated input can be served from the cache.',
    triggeringMetric,
    triggeringValue,
    estimatedSavingsUsd: savings,
    sourceIds: [sourceId],
    compactHeadline: 'Enable prompt caching',
    triggerSummary: `${Math.round(totalInputTokens).toLocaleString()} input tokens with low cache reuse`,
    topSlotEligible: hasSavings,
    targetSourceId: sourceId,
    targetCardAnchor: `#tool-card-${sourceId}`,
    targetRecommendationAnchor: `#rec-${sourceId}-R1`,
    ...(hasSavings ? { savingsLabel: `Save ~$${savings.toFixed(2)}` } : {}),
  };
}
