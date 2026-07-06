import { lookupPrice } from '../../data/priceMap.js';
import { getSourceDisplayName } from '../../lib/sourceNames.js';
import { RecommendationResult, SourceMetrics } from '../../types/index.js';
import type { Rule, RuleContext } from './index.js';

type MetricsWithDailyInput = SourceMetrics & {
  p90DailyInputTokens?: number;
  dailyInputTokens?: Array<{ date: string; inputTokens: number }>;
  dailyTokensByModel?: Array<{ date: string; inputTokens?: number }>;
  copilotDailyInputTokens?: Array<{ date: string; inputTokens: number }>;
};

/** Guard: R3 only fires when at least one Tier B source has data. */
function hasTierBSource(ctx: RuleContext): boolean {
  return ctx.sources.some(s => s.tier === 'B');
}

export const R3: Rule = {
  id: 'R3',
  severity: 'Medium',
  evaluate(ctx: RuleContext): RecommendationResult[] {
    if (!hasTierBSource(ctx)) return [];
    const cards: RecommendationResult[] = [];

    for (const source of ctx.sources) {
      if (source.tier !== 'B') continue;
      if ((source.aggregateInputOutputRatio ?? 0) <= 8) continue;

      const p90DailyInputTokens = resolveP90DailyInputTokens(source);
      if (p90DailyInputTokens <= 50_000) {
        continue;
      }

      const savings = estimateR3Savings(source, ctx);
      const hasSavings = savings != null && savings > 0;
      const sourceName = getSourceDisplayName(source.sourceId);
      const inputOutputMultiplier = Math.max(1, Math.round(source.aggregateInputOutputRatio ?? 0));

      cards.push({
        id: 'R3',
        severity: 'Medium',
        title: 'Your prompts may be longer than needed',
        body: `${sourceName} sends roughly ${inputOutputMultiplier}× more text than it receives back — most of your cost is going toward providing context to the AI, not the answers it gives you.

To reduce your input costs:
• Shorten repeated instructions: if you start many prompts with the same framing or setup, cut or simplify it — the model retains context within a session.
• Use persistent instructions for background context: most AI tools let you define a "system prompt" or "custom instructions" that applies to every conversation. If you re-explain your role, preferences, or project background each time, move that there — you pay for it once, not every message.
• Paste only what's relevant: when you include emails, documents, or code for context, copy in only the specific section you need, not the whole thing — every sentence you don't need still costs tokens.`,
        triggeringMetric: 'p90DailyInputTokens / aggregateInputOutputRatio',
        triggeringValue: `${Math.round(p90DailyInputTokens)} / ${(source.aggregateInputOutputRatio ?? 0).toFixed(1)}`,
        sourceIds: [source.sourceId],
        compactHeadline: 'Trim repeated input context',
        triggerSummary: `${sourceName} sends roughly ${inputOutputMultiplier}× more text than it receives back`,
        topSlotEligible: hasSavings,
        targetSourceId: source.sourceId,
        targetCardAnchor: `#tool-card-${source.sourceId}`,
        targetRecommendationAnchor: `#rec-${source.sourceId}-R3`,
        ...(hasSavings
          ? {
              estimatedSavingsUsd: savings,
              savingsLabel: `Save $${savings.toFixed(2)}`,
            }
          : {}),
      });
    }

    function estimateR3Savings(source: SourceMetrics, ctx: RuleContext): number | undefined {
      const ratio = source.aggregateInputOutputRatio ?? 0;
      if (ratio <= 1) return undefined;

      let totalInputSpend = 0;
      let pricedRows = 0;

      if (source.sourceId === 'github_copilot') {
        for (const row of source.copilotTokenBreakdownByModel ?? []) {
          const price = lookupPrice(ctx.priceMap, row.model);
          if (!price) continue;
          totalInputSpend += row.inputTokens * price.input_cost_per_token;
          pricedRows += 1;
        }
      } else {
        for (const row of source.modelBreakdown ?? []) {
          const price = lookupPrice(ctx.priceMap, row.model);
          if (!price) continue;
          totalInputSpend += row.inputTokens * price.input_cost_per_token;
          pricedRows += 1;
        }
      }

      if (pricedRows === 0) return undefined;
      return totalInputSpend * (1 - 1 / ratio) * 0.20;
    }

    return cards;
  },
};

function resolveP90DailyInputTokens(source: SourceMetrics): number {
  const metrics = source as MetricsWithDailyInput;
  if (source.sourceId === 'github_copilot') {
    return getP90DailyInputTokens(metrics.copilotDailyInputTokens ?? []);
  }

  if (typeof metrics.p90DailyInputTokens === 'number') return metrics.p90DailyInputTokens;

  if (metrics.dailyInputTokens?.length) {
    return getP90DailyInputTokens(metrics.dailyInputTokens);
  }

  if (metrics.dailyTokensByModel?.length) {
    const byDate = new Map<string, number>();
    for (const record of metrics.dailyTokensByModel) {
      byDate.set(record.date, (byDate.get(record.date) ?? 0) + (record.inputTokens ?? 0));
    }
    return getP90DailyInputTokens(
      [...byDate.entries()].map(([date, inputTokens]) => ({ date, inputTokens })),
    );
  }

  // SourceMetrics currently carries aggregate model totals, not daily token buckets.
  // Use the observed window average as a conservative inline fallback so the rule can still run.
  const totalInputTokens = source.modelBreakdown?.reduce((sum, model) => sum + model.inputTokens, 0) ?? 0;
  if (totalInputTokens === 0) return 0;

  return totalInputTokens / computeDataWindowDays(source.periodStart, source.periodEnd);
}

export function getP90DailyInputTokens(
  dailyInputTokens: { date: string; inputTokens: number }[]
): number {
  if (dailyInputTokens.length === 0) return 0;
  const sorted = [...dailyInputTokens].map(d => d.inputTokens).sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.9) - 1;
  return sorted[Math.max(0, idx)];
}

function computeDataWindowDays(start: string, end: string): number {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 1;
  return Math.max(1, Math.floor((endMs - startMs) / 86_400_000) + 1);
}
