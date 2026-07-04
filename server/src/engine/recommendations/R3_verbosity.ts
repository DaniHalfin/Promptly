import { RecommendationResult, SourceMetrics } from '../../types/index.js';
import type { Rule, RuleContext } from './index.js';

type MetricsWithDailyInput = SourceMetrics & {
  p90DailyInputTokens?: number;
  dailyInputTokens?: Array<{ date: string; inputTokens: number }>;
  dailyTokensByModel?: Array<{ date: string; inputTokens?: number }>;
  copilotDailyInputTokens?: Array<{ date: string; inputTokens: number }>;
};

export const R3: Rule = {
  id: 'R3',
  severity: 'Medium',
  evaluate(ctx: RuleContext): RecommendationResult[] {
    const cards: RecommendationResult[] = [];

    for (const source of ctx.sources) {
      if (source.tier !== 'B') continue;
      if ((source.aggregateInputOutputRatio ?? 0) <= 8) continue;

      const p90DailyInputTokens = resolveP90DailyInputTokens(source);
      if (p90DailyInputTokens <= 50_000) {
        continue;
      }

      cards.push({
        id: 'R3',
        severity: 'Medium',
        title: 'High input-token verbosity',
        body:
          `${source.sourceId} has a p90 daily input volume of ${Math.round(p90DailyInputTokens).toLocaleString()} tokens ` +
          `and an input/output ratio of ${(source.aggregateInputOutputRatio ?? 0).toFixed(1)}:1. ` +
          'Shorten repeated instructions, move stable context into reusable prompts, and trim retrieved context before sending requests.',
        triggeringMetric: 'p90DailyInputTokens / aggregateInputOutputRatio',
        triggeringValue: `${Math.round(p90DailyInputTokens)} / ${(source.aggregateInputOutputRatio ?? 0).toFixed(1)}`,
        sourceIds: [source.sourceId],
      });
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
