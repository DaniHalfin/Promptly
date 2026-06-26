import { lookupPrice } from '../../data/priceMap.js';
import { RecommendationResult, SourceMetrics } from '../../types/index.js';
import type { Rule, RuleContext } from './index.js';

const DOWNGRADE_MAP: Array<{ pattern: string; cheaper: string }> = [
  { pattern: 'gpt-4o', cheaper: 'gpt-4o-mini' },
  { pattern: 'gpt-4-turbo', cheaper: 'gpt-4o-mini' },
  { pattern: 'claude-3-5-sonnet', cheaper: 'claude-3-haiku' },
  { pattern: 'claude-3-opus', cheaper: 'claude-3-5-sonnet' },
];

const COPILOT_DOWNGRADE_MAP: Array<{ pattern: RegExp; cheaper: string; rationale: string }> = [
  { pattern: /^gpt-5\.4(?!-mini)|^gpt-5\.5(?!-mini)/i, cheaper: 'gpt-5.4-mini', rationale: '5–20x cheaper; equivalent quality for code completion and short queries' },
  { pattern: /^claude-opus-4/i, cheaper: 'claude-haiku-4-5', rationale: '10–30x cheaper; suitable for straightforward Chat queries' },
  { pattern: /^claude-sonnet-4/i, cheaper: 'claude-haiku-4-5', rationale: '3–5x cheaper; appropriate for most coding assistance tasks' },
  { pattern: /^gemini-3-1-pro/i, cheaper: 'gemini-3-5-flash', rationale: '4–8x cheaper; comparable quality for standard tasks' },
  { pattern: /^claude-fable-5/i, cheaper: 'claude-sonnet-4-6', rationale: 'Significant cost reduction; Fable 5 reserved for complex multi-step tasks' },
];

export const R2: Rule = {
  id: 'R2',
  severity: 'High',
  evaluate(ctx: RuleContext): RecommendationResult[] {
    return [...evaluateTierBTokenSources(ctx), ...evaluateCopilot(ctx)];
  },
};

function evaluateTierBTokenSources(ctx: RuleContext): RecommendationResult[] {
  const cards: RecommendationResult[] = [];

  for (const source of ctx.sources) {
    if (source.tier !== 'B' || source.sourceId === 'github_copilot' || !source.modelBreakdown) continue;

    const periodDays = computeDataWindowDays(source.periodStart, source.periodEnd);

    for (const model of source.modelBreakdown) {
      const downgrade = DOWNGRADE_MAP.find(entry => model.model.includes(entry.pattern));
      if (!downgrade) continue;
      if (model.estimatedCostUsd < 5) continue;
      if (model.estimatedCostShare <= 0.3) continue;

      const avgOutputPerDay = model.outputTokens / periodDays;
      if (avgOutputPerDay >= 500) continue;

      const currentPrice = lookupPrice(ctx.priceMap, model.model);
      const cheaperPrice = lookupPrice(ctx.priceMap, downgrade.cheaper);
      const estimatedSavingsUsd =
        currentPrice && cheaperPrice
          ? Math.max(
              0,
              model.inputTokens * currentPrice.input_cost_per_token +
                model.outputTokens * currentPrice.output_cost_per_token -
                (model.inputTokens * cheaperPrice.input_cost_per_token +
                  model.outputTokens * cheaperPrice.output_cost_per_token)
            )
          : undefined;

      cards.push({
        id: 'R2',
        severity: 'High',
        title: 'High-cost model used for low-output tasks',
        body:
          `${model.model} accounts for ${(model.estimatedCostShare * 100).toFixed(1)}% of ${source.sourceId} spend ` +
          `but generates an average of only ${Math.round(avgOutputPerDay)} output tokens per day. Consider testing ${downgrade.cheaper}.`,
        triggeringMetric: 'Model cost share',
        triggeringValue: `${(model.estimatedCostShare * 100).toFixed(1)}%`,
        estimatedSavingsUsd,
        sourceIds: [source.sourceId],
      });
    }
  }

  return cards;
}

function evaluateCopilot(ctx: RuleContext): RecommendationResult[] {
  const copilot = ctx.sources.find(source => source.sourceId === 'github_copilot');
  if (!copilot || (copilot.copilotNetSpendUsd ?? 0) < 5 || !copilot.copilotModelDistribution) return [];

  return copilot.copilotModelDistribution.flatMap(model => {
    if (model.share <= 0.3) return [];

    const downgrade = COPILOT_DOWNGRADE_MAP.find(entry => entry.pattern.test(model.model));
    if (!downgrade) return [];
    if (model.model === downgrade.cheaper) return [];

    const estimatedSavingsUsd = estimateCopilotSavings(copilot, model.model, downgrade.cheaper);

    return [
      {
        id: 'R2',
        severity: 'High',
        title: 'Premium Copilot model drives most AI credit spend',
        body:
          `${model.model} accounts for ${(model.share * 100).toFixed(1)}% of Copilot AI credit spend. ` +
          `${downgrade.cheaper} is ${downgrade.rationale}. Consider switching to ${downgrade.cheaper} for routine Chat and CLI interactions in Copilot settings.`,
        triggeringMetric: 'Copilot model cost share',
        triggeringValue: `${(model.share * 100).toFixed(1)}%`,
        estimatedSavingsUsd,
        sourceIds: ['github_copilot'],
      } satisfies RecommendationResult,
    ];
  });
}

function estimateCopilotSavings(source: SourceMetrics, modelName: string, cheaperName: string): number | undefined {
  const spendRows = source.copilotSpendByModel ?? [];
  const currentSpend = spendRows.find(row => row.model === modelName)?.netSpendUsd;
  if (currentSpend === undefined) return undefined;

  // SourceMetrics does not carry Copilot pricePerUnit, so only emit a conservative estimate
  // when the cheaper model already appears in the observed billing distribution.
  const cheaperSpend = spendRows.find(row => row.model === cheaperName)?.netSpendUsd;
  if (cheaperSpend === undefined) return undefined;

  return Math.max(0, currentSpend - cheaperSpend);
}

function computeDataWindowDays(start: string, end: string): number {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 1;
  return Math.max(1, Math.floor((endMs - startMs) / 86_400_000) + 1);
}

