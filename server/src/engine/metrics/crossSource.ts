import { AnalysisRequest, CrossSourceSummary, SourceReport } from '../../types/index.js';
import { PriceMap, lookupPrice } from '../../data/priceMap.js';

export function totalActualSpendUsd(sources: SourceReport[]): number {
  return sources.reduce((sum, source) => {
    const metrics = source.metrics;
    if (!metrics) return sum;

    return sum + (metrics.totalActualSpendUsd ?? 0) + (metrics.copilotTotalCostUsd ?? 0);
  }, 0);
}

export function totalTokens(sources: SourceReport[]): { actual: number; estimated: number } {
  return sources.reduce(
    (totals, source) => {
      const metrics = source.metrics;
      if (!metrics) return totals;

      totals.actual += metrics.modelBreakdown?.reduce((sum, model) => sum + model.inputTokens + model.outputTokens, 0) ?? 0;
      totals.estimated += metrics.estimatedTotalTokens ?? 0;
      return totals;
    },
    { actual: 0, estimated: 0 }
  );
}

export function analysisPeriod(
  sources: SourceReport[],
  req?: AnalysisRequest
): { periodStart: string; periodEnd: string } {
  const sourceStarts = sources
    .map(source => source.metrics?.periodStart)
    .filter((date): date is string => Boolean(date));
  const sourceEnds = sources
    .map(source => source.metrics?.periodEnd)
    .filter((date): date is string => Boolean(date));
  const requestStarts = req?.sources
    .map(source => source.startDate)
    .filter((date): date is string => Boolean(date)) ?? [];
  const requestEnds = req?.sources
    .map(source => source.endDate)
    .filter((date): date is string => Boolean(date)) ?? [];

  const now = new Date();
  const defaultStart = new Date(now.getTime() - 86400000 * 30).toISOString().split('T')[0];
  const defaultEnd = now.toISOString().split('T')[0];

  return {
    periodStart: [...sourceStarts, ...requestStarts].sort()[0] ?? defaultStart,
    periodEnd: [...sourceEnds, ...requestEnds].sort().at(-1) ?? defaultEnd,
  };
}

export function computeCrossSourceMetrics(reports: SourceReport[], priceMap: PriceMap): CrossSourceSummary {
  let totalEstimatedSpend = 0;
  const tokenTotals = totalTokens(reports);

  for (const report of reports) {
    if (!report.metrics?.estimatedTotalTokens) continue;

    // Estimate cost using baseline model for Tier C file-export sources.
    const baseModel = report.source_id === 'chatgpt_export' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022';
    const price = lookupPrice(priceMap, baseModel);
    if (!price) continue;

    const userShare = report.metrics.userTokenShare || 0.5;
    const assistantShare = report.metrics.assistantTokenShare || 0.5;
    const userTokens = report.metrics.estimatedTotalTokens * userShare;
    const assistantTokens = report.metrics.estimatedTotalTokens * assistantShare;
    totalEstimatedSpend += userTokens * price.input_cost_per_token + assistantTokens * price.output_cost_per_token;
  }

  return {
    total_actual_spend_usd: totalActualSpendUsd(reports),
    total_estimated_spend_usd: totalEstimatedSpend,
    total_actual_tokens: tokenTotals.actual,
    total_estimated_tokens: tokenTotals.estimated,
  };
}
