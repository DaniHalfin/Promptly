import type { AnalysisReport, SourceReport, SourceMetrics } from '../types/index.js';

export function transformReportForExport(report: AnalysisReport): unknown {
  return { ...report, sources: report.sources.map(transformSourceReport) };
}

function transformSourceReport(source: SourceReport): unknown {
  if (source.source_id !== 'github_copilot' || !source.metrics) return source;
  return { ...source, metrics: transformCopilotMetrics(source.metrics) };
}

function transformCopilotMetrics(metrics: SourceMetrics): unknown {
  const breakdown = metrics.copilotTokenBreakdownByModel ?? [];
  const costBreakdown = metrics.copilotModelCostBreakdown ?? [];
  const cachedFraction = metrics.copilotCachedTokenFraction;
  return {
    sourceId: metrics.sourceId, tier: metrics.tier,
    periodStart: metrics.periodStart, periodEnd: metrics.periodEnd, warnings: metrics.warnings,
    session_count: metrics.copilotSessionCount ?? 0,
    total_cost_usd: metrics.copilotTotalCostUsd ?? 0,
    model_breakdown: breakdown.map(row => {
      const costEntry = costBreakdown.find(c => c.model === row.model);
      return {
        model: row.model,
        input_tokens: row.inputTokens, output_tokens: row.outputTokens,
        cache_read_tokens: row.cacheReadTokens, cache_write_tokens: row.cacheWriteTokens,
        reasoning_tokens: row.reasoningTokens, request_count: row.requestCount,
        request_cost: row.requestCost, cost_share: costEntry?.costShare ?? 0,
      };
    }),
    cached_token_fraction: cachedFraction
      ? { aggregate: cachedFraction.aggregate, per_model: cachedFraction.perModel.map(({ model, fraction }) => ({ model, fraction })) }
      : undefined,
  };
}
