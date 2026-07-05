import { AnalysisRequest, CrossSourceSummary, RecommendationId, RecommendationResult, SourceReport, TrendStatus, SpendByToolEntry, DailySpendEntry } from '../../types/index.js';
import { PriceMap } from '../../data/priceMap.js';

const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  github_copilot: 'GitHub Copilot',
  chatgpt_export: 'ChatGPT (Export)',
  claude_export: 'Claude.ai (Export)',
  claude_code: 'Claude Code',
};

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

      if (source.source_id === 'github_copilot') {
        totals.actual += metrics.copilotTokenBreakdownByModel?.reduce((sum, model) => sum + model.inputTokens + model.outputTokens, 0) ?? 0;
      } else {
        totals.actual += metrics.modelBreakdown?.reduce((sum, model) => sum + model.inputTokens + model.outputTokens, 0) ?? 0;
      }
      totals.estimated += metrics.estimatedTotalTokens ?? 0;
      return totals;
    },
    { actual: 0, estimated: 0 }
  );
}

/** Actual tokens for Tier B sources only (used for effective cost computation). */
function tierBActualTokens(reports: SourceReport[]): number {
  return reports.reduce((total, source) => {
    if (source.tier !== 'B') return total;
    const metrics = source.metrics;
    if (!metrics) return total;
    if (source.source_id === 'github_copilot') {
      return total + (metrics.copilotTokenBreakdownByModel?.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0) ?? 0);
    }
    return total + (metrics.modelBreakdown?.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0) ?? 0);
  }, 0);
}

/** Unified actual spend for a single Tier B source (handles Copilot vs non-Copilot). */
function sourceTierBSpend(report: SourceReport): number {
  if (report.tier !== 'B' || !report.metrics) return 0;
  const m = report.metrics;
  // totalSpendUsd is the unified alias (set by computeTierBMetrics)
  if (m.totalSpendUsd != null) return m.totalSpendUsd;
  // Fallback: copilotTotalCostUsd for Copilot, totalActualSpendUsd for others
  return (m.copilotTotalCostUsd ?? 0) + (m.totalActualSpendUsd ?? 0);
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

export function computeCrossSourceMetrics(reports: SourceReport[], _priceMap: PriceMap): CrossSourceSummary {
  // ── Tier B spend and tokens ──────────────────────────────────────────────
  let tierBSpendTotal = 0;
  for (const r of reports) {
    tierBSpendTotal += sourceTierBSpend(r);
  }

  const tierBTokenCount = tierBActualTokens(reports);

  // ── Tier C estimated spend ──────────────────────────────────────────────
  let tierCEstimatedSpend = 0;
  let hasTierC = false;
  for (const r of reports) {
    if (r.tier !== 'C' || !r.metrics) continue;
    const est = r.metrics.estimated_relative_cost_usd ?? r.metrics.estimatedRelativeCostUsd;
    if (est != null && est > 0) {
      tierCEstimatedSpend += est;
      hasTierC = true;
    }
  }

  // ── Totals ───────────────────────────────────────────────────────────────
  const total_actual_spend_usd = tierBSpendTotal;
  const total_estimated_spend_usd = tierBSpendTotal + tierCEstimatedSpend;
  const includes_estimates = hasTierC;

  const tokenTotals = totalTokens(reports);

  // ── Effective cost per million tokens (Tier B only) ─────────────────────
  let effective_cost_per_million_tokens_usd: number | null = null;
  if (tierBTokenCount > 0) {
    effective_cost_per_million_tokens_usd = (tierBSpendTotal / tierBTokenCount) * 1_000_000;
  }

  // ── Spend by tool (sorted descending by estimated_spend_usd) ────────────
  const spend_by_tool: SpendByToolEntry[] = [];
  for (const r of reports) {
    if (!r.metrics) continue;
    let estimatedSpend = 0;
    let is_estimated = false;
    let estimate_label: string | undefined;

    if (r.tier === 'B') {
      estimatedSpend = sourceTierBSpend(r);
      is_estimated = false;
    } else if (r.tier === 'C') {
      estimatedSpend = r.metrics.estimated_relative_cost_usd ?? r.metrics.estimatedRelativeCostUsd ?? 0;
      is_estimated = true;
      const model = r.metrics.baselineModelAssumption ?? 'gpt-4o';
      estimate_label = `Estimated via ${model} pricing`;
    }

    spend_by_tool.push({
      source_id: r.source_id,
      display_name: SOURCE_DISPLAY_NAMES[r.source_id] ?? r.source_id,
      estimated_spend_usd: estimatedSpend,
      percentage_of_total: 0, // computed after sorting
      tier: r.tier,
      is_estimated,
      ...(estimate_label ? { estimate_label } : {}),
      rank: 0, // set after sorting
    });
  }

  spend_by_tool.sort((a, b) => b.estimated_spend_usd - a.estimated_spend_usd);
  const grandTotal = spend_by_tool.reduce((s, e) => s + e.estimated_spend_usd, 0);
  for (let i = 0; i < spend_by_tool.length; i++) {
    spend_by_tool[i].rank = i + 1;
    spend_by_tool[i].percentage_of_total = grandTotal > 0 ? (spend_by_tool[i].estimated_spend_usd / grandTotal) * 100 : 0;
  }

  // ── Daily spend (merge Tier B dailySpend + proportional Tier C allocation) ─
  const dailySpendMap = new Map<string, { spend_usd: number; has_tier_c: boolean }>();

  for (const r of reports) {
    if (r.tier !== 'B' || !r.metrics) continue;
    const dailySpend = r.metrics.dailySpend;
    if (!dailySpend) continue;
    for (const d of dailySpend) {
      const existing = dailySpendMap.get(d.date);
      if (existing) {
        existing.spend_usd += d.spendUsd;
      } else {
        dailySpendMap.set(d.date, { spend_usd: d.spendUsd, has_tier_c: false });
      }
    }
  }

  // Tier C daily allocation (proportional from estimated_relative_cost_usd)
  for (const r of reports) {
    if (r.tier !== 'C' || !r.metrics) continue;
    const totalConvs = r.metrics.total_conversations ?? 0;
    const estCost = r.metrics.estimated_relative_cost_usd ?? 0;
    if (totalConvs === 0 || estCost === 0) continue;

    const daily = r.metrics.daily_conversation_activity ?? [];
    for (const d of daily) {
      const dayAllocation = estCost * (d.conversation_count / totalConvs);
      const existing = dailySpendMap.get(d.date);
      if (existing) {
        existing.spend_usd += dayAllocation;
        existing.has_tier_c = true;
      } else {
        dailySpendMap.set(d.date, { spend_usd: dayAllocation, has_tier_c: true });
      }
    }
  }

  const daily_spend: DailySpendEntry[] = Array.from(dailySpendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { spend_usd, has_tier_c }]) => ({
      date,
      spend_usd,
      ...(has_tier_c ? { includes_estimated_tier_c: true } : {}),
    }));

  // ── Trend and spike: propagate from Tier C source if available ──────────
  let trend: TrendStatus = {
    status: 'insufficient_data',
    observed_days: 0,
    required_days: 30,
    message: 'No activity data available for trend computation.',
  };
  let spike_callout = null;

  for (const r of reports) {
    if (r.tier === 'C' && r.metrics?.trend) {
      trend = r.metrics.trend;
      spike_callout = r.metrics.spike_callout ?? null;
      break;
    }
  }

  return {
    total_actual_spend_usd,
    total_estimated_spend_usd,
    total_actual_tokens: tokenTotals.actual,
    total_estimated_tokens: tokenTotals.estimated,
    effective_cost_per_million_tokens_usd,
    daily_spend,
    spend_by_tool,
    trend,
    spike_callout,
    ...(includes_estimates ? { includes_estimates: true } : {}),
  };
}

/** Select the single highest-priority recommendation from the full set.
 *  Priority order: High > Medium > Low. Returns null when the list is empty.
 */
export function selectTopRecommendation(
  recommendations: RecommendationResult[]
): { id: RecommendationId; title: string; priority: 'high' | 'medium' | 'low' } | null {
  if (recommendations.length === 0) return null;

  const SEVERITY_ORDER: Record<RecommendationResult['severity'], number> = {
    High: 0,
    Medium: 1,
    Low: 2,
  };

  const top = [...recommendations].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  )[0];

  return {
    id: top.id,
    title: top.title,
    priority: top.severity.toLowerCase() as 'high' | 'medium' | 'low',
  };
}
