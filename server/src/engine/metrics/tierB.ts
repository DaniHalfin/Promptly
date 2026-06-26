import { SourceMetrics, NormalizedSourceData, ModelBreakdownEntry } from '../../types/index.js';
import { PriceMap, lookupPrice } from '../../data/priceMap.js';

export function computeTierBMetrics(data: NormalizedSourceData, priceMap: PriceMap): Partial<SourceMetrics> {
  if (data.sourceId === 'github_copilot') {
    return computeCopilotTierBMetrics(data);
  }

  if (!data.dailyCostUsd || !data.dailyTokensByModel) {
    return {};
  }

  // 7.4 Total actual spend
  const totalActualSpendUsd = data.dailyCostUsd.reduce((sum, d) => sum + (d.costUsd || 0), 0);

  // 7.5 Daily spend trend
  const dailySpend = data.dailyCostUsd.map(d => ({ date: d.date, spendUsd: d.costUsd || 0 }));

  // Group tokens by model
  const tokensByModel: Record<string, { input: number; output: number; cached: number; cacheCreate: number; cacheRead: number }> = {};
  const datesWithTokenData = new Set<string>();
  for (const record of data.dailyTokensByModel) {
    if (!record.model) continue;
    datesWithTokenData.add(record.date);
    if (!tokensByModel[record.model]) {
      tokensByModel[record.model] = { input: 0, output: 0, cached: 0, cacheCreate: 0, cacheRead: 0 };
    }
    tokensByModel[record.model].input += record.inputTokens || 0;
    tokensByModel[record.model].output += record.outputTokens || 0;
    tokensByModel[record.model].cached += record.cachedInputTokens || 0;
    tokensByModel[record.model].cacheCreate += record.cacheCreationInputTokens || 0;
    tokensByModel[record.model].cacheRead += record.cacheReadInputTokens || 0;
  }

  // 7.6 Model cost share (estimated)
  const modelBreakdown: ModelBreakdownEntry[] = [];
  let totalEstimatedCost = 0;
  const modelCosts: Record<string, number> = {};

  for (const [model, tokens] of Object.entries(tokensByModel)) {
    const price = lookupPrice(priceMap, model);
    if (!price) continue;

    const modelCost =
      (tokens.input * price.input_cost_per_token) +
      (tokens.output * price.output_cost_per_token) +
      (tokens.cacheCreate * (price.cache_creation_input_token_cost ?? 0)) +
      (tokens.cacheRead * (price.cache_read_input_token_cost ?? 0));
    modelCosts[model] = modelCost;
    totalEstimatedCost += modelCost;
  }

  for (const [model, cost] of Object.entries(modelCosts)) {
    const tokens = tokensByModel[model];
    const ratio = tokens.output > 0 ? tokens.input / tokens.output : tokens.input > 0 ? tokens.input : 1;
    modelBreakdown.push({
      model,
      estimatedCostShare: totalEstimatedCost > 0 ? cost / totalEstimatedCost : 0,
      estimatedCostUsd: cost,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      cachedInputTokens: tokens.cached || undefined,
      inputOutputRatio: ratio,
      ...(data.sourceId === 'openai' ? { estimated: true } : {}),
    });
  }

  // 7.7 Input/output ratio
  const totalInput = Object.values(tokensByModel).reduce((sum, t) => sum + t.input, 0);
  const totalOutput = Object.values(tokensByModel).reduce((sum, t) => sum + t.output, 0);
  const totalCacheCreate = Object.values(tokensByModel).reduce((sum, t) => sum + t.cacheCreate, 0);
  const totalCacheRead = Object.values(tokensByModel).reduce((sum, t) => sum + t.cacheRead, 0);
  const totalInputWithCache = totalInput + totalCacheCreate + totalCacheRead;
  const aggregateInputOutputRatio = totalOutput > 0 ? totalInput / totalOutput : totalInput > 0 ? totalInput : 1;

  // 7.8 Cached token fraction (Anthropic / Claude Code)
  let cachedTokenFraction: number | undefined;
  let cachedTokenSavingsUsd: number | undefined;
  const hasCache = Object.values(tokensByModel).some(t => t.cacheRead > 0 || t.cacheCreate > 0);
  if (hasCache) {
    const totalCacheInputs = Object.values(tokensByModel).reduce((sum, t) => sum + (t.input + t.cacheCreate + t.cacheRead), 0);
    const totalCacheRead = Object.values(tokensByModel).reduce((sum, t) => sum + t.cacheRead, 0);
    cachedTokenFraction = totalCacheInputs > 0 ? totalCacheRead / totalCacheInputs : 0;
    
    // Estimate savings using actual model pricing
    cachedTokenSavingsUsd = 0;
    for (const [model, tokens] of Object.entries(tokensByModel)) {
      if (tokens.cacheRead > 0) {
        const priceEntry = lookupPrice(priceMap, model);
        if (priceEntry && priceEntry.cache_read_input_token_cost !== undefined) {
          cachedTokenSavingsUsd += tokens.cacheRead * (priceEntry.input_cost_per_token - priceEntry.cache_read_input_token_cost);
        }
      }
    }
  }

  // 7.9 Average daily spend
  const avgDailySpendUsd = dailySpend.length > 0 ? totalActualSpendUsd / dailySpend.length : 0;

  // 7.10 Peak spend day
  const peakSpendDay = dailySpend.length > 0 ? dailySpend.reduce((max, d) => (d.spendUsd > max.spendUsd ? d : max)) : undefined;

  // 7.11 7-day rolling average
  const last7Days = dailySpend.slice(-7);
  const rollingAvgSpend7dUsd = last7Days.length > 0 ? last7Days.reduce((sum, d) => sum + d.spendUsd, 0) / last7Days.length : 0;

  // 7.12 Month-over-month change
  let momChangePct: number | null = null;
  if (dailySpend.length >= 45) {
    const firstHalf = dailySpend.slice(0, Math.floor(dailySpend.length / 2));
    const secondHalf = dailySpend.slice(Math.floor(dailySpend.length / 2));
    const firstSum = firstHalf.reduce((sum, d) => sum + d.spendUsd, 0);
    const secondSum = secondHalf.reduce((sum, d) => sum + d.spendUsd, 0);
    if (firstSum > 0) momChangePct = ((secondSum - firstSum) / firstSum) * 100;
  }

  const dayCount = daysInPeriod(data.periodStart, data.periodEnd) ?? Math.max(datesWithTokenData.size, dailySpend.length, 1);
  const avgDailyOutputTokensPerModel = Object.entries(tokensByModel)
    .map(([model, tokens]) => ({
      model,
      avgDailyOutputTokens: tokens.output / dayCount,
    }))
    .sort((a, b) => b.avgDailyOutputTokens - a.avgDailyOutputTokens);

  return {
    totalActualSpendUsd,
    dailySpend,
    modelBreakdown: modelBreakdown.length > 0 ? modelBreakdown : undefined,
    aggregateInputOutputRatio,
    ...(data.sourceId === 'anthropic'
      ? {
          cachedTokenFractionAnthropic: cachedTokenFraction,
          cachedTokenSavingsUsdAnthropic: cachedTokenSavingsUsd,
          totalInputTokensAnthropic: totalInputWithCache,
          cacheCreationInputTokensAnthropic: totalCacheCreate,
        }
      : {}),
    ...(data.sourceId === 'claude_code'
      ? {
          cachedTokenFractionClaudeCode: cachedTokenFraction,
          cachedTokenSavingsUsdClaudeCode: cachedTokenSavingsUsd,
          totalInputTokensClaudeCode: totalInputWithCache,
          cacheCreationInputTokensClaudeCode: totalCacheCreate,
          claudeCodeSessionCount: data.sessionCount,
          claudeCodeAvgTokensPerSession:
            data.sessionCount && data.sessionCount > 0 ? (totalInputWithCache + totalOutput) / data.sessionCount : undefined,
          claudeCodePeakHourFraction: data.claudeCodePeakHourFraction,
        }
      : {}),
    avgDailySpendUsd,
    peakSpendDay,
    rollingAvgSpend7dUsd,
    momChangePct,
    avgDailyOutputTokensPerModel,
  };
}

function daysInPeriod(periodStart: string, periodEnd: string): number | null {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1);
}

function computeCopilotTierBMetrics(data: NormalizedSourceData): Partial<SourceMetrics> {
  const sessions = data.copilotSessions ?? [];
  if (sessions.length === 0) return { copilotNetSpendUsd: 0, copilotSessionCount: 0 };

  const modelAgg: Record<string, { requestCost: number; inputTokens: number; outputTokens: number }> = {};
  let totalNetSpend = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const session of sessions) {
    totalNetSpend += session.totalCost;
    for (const [model, m] of Object.entries(session.models)) {
      if (!modelAgg[model]) modelAgg[model] = { requestCost: 0, inputTokens: 0, outputTokens: 0 };
      modelAgg[model].requestCost += m.requestCost;
      modelAgg[model].inputTokens += m.inputTokens;    // TOTAL — do NOT add cache subsets
      modelAgg[model].outputTokens += m.outputTokens;  // TOTAL — do NOT add reasoning subsets
      totalInputTokens += m.inputTokens;
      totalOutputTokens += m.outputTokens;
    }
  }

  const copilotSpendByModel = Object.entries(modelAgg)
    .map(([model, agg]) => ({
      model,
      netAmountUsd: agg.requestCost,   // kept for R2 backward compat
      netSpendUsd: agg.requestCost,
      spendShare: totalNetSpend > 0 ? agg.requestCost / totalNetSpend : 0,
    }))
    .sort((a, b) => b.netSpendUsd - a.netSpendUsd);

  const copilotModelDistribution = copilotSpendByModel.map(row => ({
    model: row.model,
    share: row.spendShare,
  }));

  // TODO: add dailySpend aggregation when a Copilot trend chart is added (R4)
  return {
    copilotNetSpendUsd: totalNetSpend,
    copilotSpendByModel,
    copilotModelDistribution,
    copilotTotalInputTokens: totalInputTokens,
    copilotTotalOutputTokens: totalOutputTokens,
    copilotSessionCount: sessions.length,
  };
}
