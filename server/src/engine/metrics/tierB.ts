import { SourceMetrics, NormalizedSourceData, NormalizedCopilotSession, ModelBreakdownEntry, EfficiencySignal } from '../../types/index.js';
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
  const totalActualTokens = totalInput + totalOutput;
  const aggregateInputNumerator =
    data.sourceId === 'anthropic' || data.sourceId === 'claude_code'
      ? totalInputWithCache
      : totalInput;
  const aggregateInputOutputRatio =
    totalOutput > 0 ? aggregateInputNumerator / totalOutput : aggregateInputNumerator > 0 ? aggregateInputNumerator : 1;
  const efficiencySignal = buildEfficiencySignal(aggregateInputOutputRatio);

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
    const sorted = [...dailySpend].sort((a, b) => a.date.localeCompare(b.date));
    const last30 = sorted.slice(-30);
    const prev30 = sorted.slice(-60, -30);
    const last30Sum = last30.reduce((sum, d) => sum + d.spendUsd, 0);
    const prev30Sum = prev30.reduce((sum, d) => sum + d.spendUsd, 0);
    if (prev30Sum > 0) momChangePct = ((last30Sum - prev30Sum) / prev30Sum) * 100;
  }

  const dayCount = daysInPeriod(data.periodStart, data.periodEnd) ?? Math.max(datesWithTokenData.size, dailySpend.length, 1);
  const avgDailyOutputTokensPerModel = Object.entries(tokensByModel)
    .map(([model, tokens]) => ({
      model,
      avgDailyOutputTokens: tokens.output / dayCount,
    }))
    .sort((a, b) => b.avgDailyOutputTokens - a.avgDailyOutputTokens);

  const projectedR1SavingsUsd =
    data.sourceId === 'anthropic' || data.sourceId === 'claude_code'
      ? computeProjectedR1SavingsUsd(tokensByModel, cachedTokenFraction, priceMap)
      : undefined;

  return {
    totalActualSpendUsd,
    totalActualTokens,
    totalSpendUsd: totalActualSpendUsd,
    dailySpend,
    modelBreakdown: modelBreakdown.length > 0 ? modelBreakdown : undefined,
    aggregateInputOutputRatio,
    efficiencySignal,
    ...(data.sourceId === 'anthropic'
      ? {
          cachedTokenFractionAnthropic: cachedTokenFraction,
          cachedTokenSavingsUsdAnthropic: cachedTokenSavingsUsd,
          totalInputTokensAnthropic: totalInputWithCache,
          cacheCreationInputTokensAnthropic: totalCacheCreate,
          projectedR1SavingsUsd,
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
          projectedR1SavingsUsd,
        }
      : {}),
    avgDailySpendUsd,
    peakSpendDay,
    rollingAvgSpend7dUsd,
    momChangePct,
    avgDailyOutputTokensPerModel,
  };
}

function buildEfficiencySignal(ratio: number): EfficiencySignal {
  if (ratio > 8) {
    return {
      kind: 'input_heavy',
      headline: 'Input-heavy usage',
      explanation: 'Most of your cost came from sending context, not getting answers.',
      inputOutputRatio: ratio,
    };
  }
  if (ratio < 1) {
    return {
      kind: 'output_heavy',
      headline: 'Output-heavy usage',
      explanation: "You're generating a lot — typical for coding or writing workflows.",
      inputOutputRatio: ratio,
    };
  }
  return {
    kind: 'balanced',
    headline: 'Balanced usage',
    explanation: 'Your input and output token mix is balanced for this period.',
    inputOutputRatio: ratio,
  };
}

function daysInPeriod(periodStart: string, periodEnd: string): number | null {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1);
}

function computeProjectedR1SavingsUsd(
  tokensByModel: Record<string, { input: number; output: number; cached: number; cacheCreate: number; cacheRead: number }>,
  currentCachedFraction: number | undefined,
  priceMap: PriceMap,
): number | undefined {
  const uncachedFraction = 1 - (currentCachedFraction ?? 0);
  let projectedR1SavingsUsd = 0;
  let pricedModelCount = 0;

  for (const [model, tokens] of Object.entries(tokensByModel)) {
    const totalInputTokens = tokens.input + tokens.cacheCreate + tokens.cacheRead;
    if (totalInputTokens <= 0) continue;

    const price = lookupPrice(priceMap, model);
    if (!price || price.cache_read_input_token_cost === undefined) {
      return undefined;
    }

    projectedR1SavingsUsd +=
      totalInputTokens * (price.input_cost_per_token - price.cache_read_input_token_cost) * uncachedFraction;
    pricedModelCount += 1;
  }

  return pricedModelCount > 0 ? projectedR1SavingsUsd : undefined;
}

// ─── Copilot pure metric functions (§3.5) ────────────────────────────────────

/** §7.15 — Number of session.shutdown events in the analysis window. */
export function copilotSessionCount(sessions: NormalizedCopilotSession[]): number {
  return sessions.length;
}

/**
 * §7.17 — Sum of session.totalCost across all sessions.
 * totalCost is the raw totalPremiumRequests field — not a recomputed per-model sum.
 */
export function copilotTotalCost(sessions: NormalizedCopilotSession[]): number {
  return sessions.reduce((sum, s) => sum + s.totalCost, 0);
}

/**
 * §7.18 — Per-model spend breakdown with full token detail.
 */
export function copilotModelCostBreakdown(sessions: NormalizedCopilotSession[]): {
  copilotModelCostBreakdown: Array<{ model: string; costUsd: number; costShare: number }>;
  copilotTotalInputTokens: number;
  copilotTotalOutputTokens: number;
} {
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

  const breakdown = Object.entries(modelAgg)
    .map(([model, agg]) => ({
      model,
      costUsd: agg.requestCost,
      costShare: totalNetSpend > 0 ? agg.requestCost / totalNetSpend : 0,
    }))
    .sort((a, b) => b.costUsd - a.costUsd);

  return { copilotModelCostBreakdown: breakdown, copilotTotalInputTokens: totalInputTokens, copilotTotalOutputTokens: totalOutputTokens };
}

/** §7.19 — Token breakdown by model, sorted desc by requestCost. */
export function copilotTokenBreakdownByModel(sessions: NormalizedCopilotSession[]): Array<{
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  requestCount: number;
  requestCost: number;
}> {
  const modelAgg: Record<string, {
    requestCount: number; requestCost: number;
    inputTokens: number; outputTokens: number;
    cacheReadTokens: number; cacheWriteTokens: number; reasoningTokens: number;
  }> = {};

  for (const session of sessions) {
    for (const [model, m] of Object.entries(session.models)) {
      if (!modelAgg[model]) {
        modelAgg[model] = { requestCount: 0, requestCost: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 };
      }
      modelAgg[model].requestCount += m.requestCount;
      modelAgg[model].requestCost += m.requestCost;
      modelAgg[model].inputTokens += m.inputTokens;
      modelAgg[model].outputTokens += m.outputTokens;
      modelAgg[model].cacheReadTokens += m.cacheReadTokens;
      modelAgg[model].cacheWriteTokens += m.cacheWriteTokens;
      modelAgg[model].reasoningTokens += m.reasoningTokens;
    }
  }

  return Object.entries(modelAgg)
    .map(([model, agg]) => ({
      model,
      inputTokens: agg.inputTokens, outputTokens: agg.outputTokens,
      cacheReadTokens: agg.cacheReadTokens, cacheWriteTokens: agg.cacheWriteTokens,
      reasoningTokens: agg.reasoningTokens, requestCount: agg.requestCount, requestCost: agg.requestCost,
    }))
    .sort((a, b) => b.requestCost - a.requestCost);
}

/** §7.20 — Cache-read fraction per model and aggregate. */
export function copilotCachedTokenFraction(sessions: NormalizedCopilotSession[]): {
  perModel: { model: string; fraction: number }[];
  aggregate: number;
} {
  const modelAgg: Record<string, { inputTokens: number; cacheReadTokens: number }> = {};

  for (const session of sessions) {
    for (const [model, m] of Object.entries(session.models)) {
      if (!modelAgg[model]) modelAgg[model] = { inputTokens: 0, cacheReadTokens: 0 };
      modelAgg[model].inputTokens += m.inputTokens;
      modelAgg[model].cacheReadTokens += m.cacheReadTokens;
    }
  }

  const perModel = Object.entries(modelAgg).map(([model, agg]) => ({
    model,
    fraction: agg.inputTokens > 0 ? agg.cacheReadTokens / agg.inputTokens : 0,
  }));

  const totalInput = Object.values(modelAgg).reduce((sum, m) => sum + m.inputTokens, 0);
  const totalCacheRead = Object.values(modelAgg).reduce((sum, m) => sum + m.cacheReadTokens, 0);
  const aggregate = totalInput > 0 ? totalCacheRead / totalInput : 0;

  return { perModel, aggregate };
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

function computeCopilotTierBMetrics(data: NormalizedSourceData): Partial<SourceMetrics> {
  const sessions = data.copilotSessions ?? [];
  if (sessions.length === 0) {
    return {
      copilotTotalCostUsd: 0,
      copilotSessionCount: 0,
      copilotDailyInputTokens: [],
      dailySpend: [],
      models_identified: [],
      totalActualTokens: 0,
      totalSpendUsd: 0,
      aggregateInputOutputRatio: 1,
      efficiencySignal: buildEfficiencySignal(1),
    };
  }

  const modelAgg: Record<string, {
    requestCount: number; requestCost: number;
    inputTokens: number; outputTokens: number;
    cacheReadTokens: number; cacheWriteTokens: number; reasoningTokens: number;
  }> = {};
  let totalNetSpend = 0;

  for (const session of sessions) {
    totalNetSpend += session.totalCost;
    for (const [model, m] of Object.entries(session.models)) {
      if (!modelAgg[model]) {
        modelAgg[model] = { requestCount: 0, requestCost: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 };
      }
      modelAgg[model].requestCount += m.requestCount;
      modelAgg[model].requestCost += m.requestCost;
      modelAgg[model].inputTokens += m.inputTokens;       // TOTAL — cache subsets are NOT additive
      modelAgg[model].outputTokens += m.outputTokens;     // TOTAL — reasoning is NOT additive
      modelAgg[model].cacheReadTokens += m.cacheReadTokens;
      modelAgg[model].cacheWriteTokens += m.cacheWriteTokens;
      modelAgg[model].reasoningTokens += m.reasoningTokens;
    }
  }

  // Per-day input token aggregation (for R3 p90 computation)
  const dailyInputMap = new Map<string, number>();
  for (const session of sessions) {
    const sessionInputTokens = Object.values(session.models).reduce(
      (sum, m) => sum + m.inputTokens, 0
    );
    dailyInputMap.set(session.date, (dailyInputMap.get(session.date) ?? 0) + sessionInputTokens);
  }
  const copilotDailyInputTokens = Array.from(dailyInputMap.entries())
    .map(([date, inputTokens]) => ({ date, inputTokens }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const copilotAvgTokensPerSession = sessions.length > 0
    ? sessions.reduce((sum, s) => {
        const sessionTokens = Object.values(s.models).reduce(
          (t, m) => t + m.inputTokens + m.outputTokens, 0
        );
        return sum + sessionTokens;
      }, 0) / sessions.length
    : undefined;

  // §7.16 token breakdown table — sorted desc by requestCost
  const tokenBreakdownByModel = Object.entries(modelAgg)
    .map(([model, agg]) => ({
      model,
      inputTokens: agg.inputTokens, outputTokens: agg.outputTokens,
      cacheReadTokens: agg.cacheReadTokens, cacheWriteTokens: agg.cacheWriteTokens,
      reasoningTokens: agg.reasoningTokens, requestCount: agg.requestCount, requestCost: agg.requestCost,
    }))
    .sort((a, b) => b.requestCost - a.requestCost);

  // §3.5 model cost breakdown
  const modelCostBreakdown = Object.entries(modelAgg)
    .map(([model, agg]) => ({
      model, costUsd: agg.requestCost,
      costShare: totalNetSpend > 0 ? agg.requestCost / totalNetSpend : 0,
    }))
    .sort((a, b) => b.costUsd - a.costUsd);

  // §7.19 cached token fraction
  const totalInputTokens = Object.values(modelAgg).reduce((sum, m) => sum + m.inputTokens, 0);
  const totalCacheRead = Object.values(modelAgg).reduce((sum, m) => sum + m.cacheReadTokens, 0);
  const cachedFraction = {
    perModel: Object.entries(modelAgg).map(([model, agg]) => ({
      model, fraction: agg.inputTokens > 0 ? agg.cacheReadTokens / agg.inputTokens : 0,
    })),
    aggregate: totalInputTokens > 0 ? totalCacheRead / totalInputTokens : 0,
  };
  const totalActualTokens = tokenBreakdownByModel.reduce(
    (sum, model) => sum + model.inputTokens + model.outputTokens,
    0,
  );
  const copilotTotalInputTokens = tokenBreakdownByModel.reduce((sum, model) => sum + model.inputTokens, 0);
  const copilotTotalOutputTokens = tokenBreakdownByModel.reduce((sum, model) => sum + model.outputTokens, 0);
  const aggregateInputOutputRatio =
    copilotTotalOutputTokens > 0
      ? copilotTotalInputTokens / copilotTotalOutputTokens
      : copilotTotalInputTokens > 0
        ? copilotTotalInputTokens
        : 1;
  const efficiencySignal = buildEfficiencySignal(aggregateInputOutputRatio);

  // Universal daily spend — aggregate net spend by session date so Copilot
  // participates in the cross-source daily_spend / trend / spike path.
  const dailySpendMap = new Map<string, number>();
  for (const session of sessions) {
    dailySpendMap.set(session.date, (dailySpendMap.get(session.date) ?? 0) + session.totalCost);
  }
  const dailySpend = Array.from(dailySpendMap.entries())
    .map(([date, spendUsd]) => ({ date, spendUsd }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const models_identified = tokenBreakdownByModel.map(entry => entry.model);

  return {
    copilotTotalCostUsd: totalNetSpend,
    copilotModelCostBreakdown: modelCostBreakdown,
    copilotTokenBreakdownByModel: tokenBreakdownByModel,
    copilotCachedTokenFraction: cachedFraction,
    copilotSessionCount: sessions.length,
    copilotAvgTokensPerSession,
    copilotDailyInputTokens,
    dailySpend,
    models_identified,
    totalActualTokens,
    totalSpendUsd: totalNetSpend,
    aggregateInputOutputRatio,
    efficiencySignal,
  };
}
