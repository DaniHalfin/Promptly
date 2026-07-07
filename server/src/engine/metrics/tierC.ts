import { SourceMetrics, NormalizedSourceData, TrendStatus, SpikeCallout, DailyConversationActivityEntry } from '../../types/index.js';
import { PriceMap, lookupPrice } from '../../data/priceMap.js';

const REQUIRED_ACTIVE_DAYS = 30;
const DEFAULT_CHATGPT_MODEL = 'gpt-4o';
const SPIKE_MIN_DAYS = 3;
const SPIKE_THRESHOLD_MULTIPLIER = 2;

/**
 * Compute trend status from daily conversation activity and date range.
 * - insufficient_data: fewer active days than required
 * - no_prior_spend: prior half of calendar range has zero conversations
 * - available: MoM % change computed from first vs second calendar half
 */
function computeTrend(
  daily: DailyConversationActivityEntry[],
  periodStart: string,
  periodEnd: string
): TrendStatus {
  const observed_days = daily.length;

  if (observed_days < REQUIRED_ACTIVE_DAYS) {
    return {
      status: 'insufficient_data',
      observed_days,
      required_days: REQUIRED_ACTIVE_DAYS,
      message: `Only ${observed_days} day${observed_days !== 1 ? 's' : ''} of activity; ${REQUIRED_ACTIVE_DAYS} required for trend analysis.`,
    };
  }

  // Calendar-based split: first half vs second half of the full date range
  const startMs = new Date(periodStart).getTime();
  const endMs = new Date(periodEnd).getTime();
  const midMs = startMs + (endMs - startMs) / 2;
  const midDateStr = new Date(midMs).toISOString().split('T')[0];

  let priorSum = 0;
  let currentSum = 0;
  for (const d of daily) {
    if (d.date <= midDateStr) {
      priorSum += d.conversation_count;
    } else {
      currentSum += d.conversation_count;
    }
  }

  if (priorSum === 0) {
    return {
      status: 'no_prior_spend',
      observed_days,
      required_days: REQUIRED_ACTIVE_DAYS,
      message: 'No conversation activity in the prior period; cannot compute trend.',
    };
  }

  const mom_change_pct = ((currentSum - priorSum) / priorSum) * 100;
  const sign = mom_change_pct >= 0 ? '+' : '';
  return {
    status: 'available',
    mom_change_pct,
    observed_days,
    required_days: REQUIRED_ACTIVE_DAYS,
    message: `Month-over-month change: ${sign}${mom_change_pct.toFixed(1)}%`,
  };
}

/**
 * Compute spike callout from daily conversation activity.
 * Fires when peak >= SPIKE_THRESHOLD_MULTIPLIER × average AND days_with_data >= SPIKE_MIN_DAYS.
 */
function computeSpike(daily: DailyConversationActivityEntry[]): SpikeCallout | null {
  if (daily.length < SPIKE_MIN_DAYS) return null;

  const total = daily.reduce((s, d) => s + d.conversation_count, 0);
  const average = total / daily.length;

  let peakEntry = daily[0];
  for (const d of daily) {
    if (d.conversation_count > peakEntry.conversation_count) {
      peakEntry = d;
    }
  }

  if (peakEntry.conversation_count < SPIKE_THRESHOLD_MULTIPLIER * average) return null;

  const multiple = peakEntry.conversation_count / average;
  return {
    date: peakEntry.date,
    conversation_count: peakEntry.conversation_count,
    multiple_of_average: multiple,
    message: `Spike detected on ${peakEntry.date}: ${peakEntry.conversation_count} conversations (${multiple.toFixed(1)}× daily average of ${average.toFixed(1)}).`,
  };
}

export function computeTierCMetrics(data: NormalizedSourceData, priceMap: PriceMap): Partial<SourceMetrics> {
  const metrics: Partial<SourceMetrics> = {};

  // ── New canonical path: chatgptAggregates (Phase 1+) ──────────────────────
  if (data.chatgptAggregates) {
    const agg = data.chatgptAggregates;

    metrics.total_conversations = agg.total_conversations;
    metrics.total_messages = agg.total_messages;
    metrics.active_days = agg.active_days;
    metrics.models_identified = agg.models_identified;
    metrics.daily_conversation_activity = agg.daily_conversation_activity;
    metrics.estimated_token_volume = agg.estimated_token_volume;
    if (agg.newest_conversation_date) {
      metrics.newest_conversation_date = agg.newest_conversation_date;
    }

    // Explicit nulls for fields not available in Tier C
    metrics.totalActualSpendUsd = undefined; // not available in Tier C
    // (total_spend_usd, cache_savings_usd, session_cost_usd, dominant_model stay undefined/null via type)

    // Estimated relative cost using the first identified model or default
    const baselineModel = agg.models_identified.length > 0
      ? agg.models_identified[0]
      : DEFAULT_CHATGPT_MODEL;
    let price = lookupPrice(priceMap, baselineModel);
    if (!price) {
      price = lookupPrice(priceMap, DEFAULT_CHATGPT_MODEL);
    }

    if (price) {
      metrics.estimated_relative_cost_usd =
        agg.estimated_user_tokens * price.input_cost_per_token +
        agg.estimated_assistant_tokens * price.output_cost_per_token;
      metrics.baselineModelAssumption = baselineModel;
    } else {
      metrics.estimated_relative_cost_usd = 0;
    }

    // Trend (requires daily activity + period boundaries)
    metrics.trend = computeTrend(
      agg.daily_conversation_activity,
      data.periodStart,
      data.periodEnd
    );

    // Spike callout
    metrics.spike_callout = computeSpike(agg.daily_conversation_activity);

    return metrics;
  }

  // ── Legacy path: conversations array (kept for backward compat / claude_export stub) ──
  if (data.conversations) {
    const conversations = data.conversations;
    const totalTokens = conversations.reduce((sum, c) => sum + (c.estimatedTotalTokens || 0), 0);
    const totalUserTokens = conversations.reduce((sum, c) => sum + (c.estimatedUserTokens || 0), 0);
    const totalAssistantTokens = conversations.reduce((sum, c) => sum + (c.estimatedAssistantTokens || 0), 0);

    metrics.estimatedTotalTokens = totalTokens;
    metrics.conversationCount = conversations.length;
    metrics.avgConversationLengthTokens = conversations.length > 0 ? totalTokens / conversations.length : 0;
    metrics.userTokenShare = totalTokens > 0 ? totalUserTokens / totalTokens : 0;
    metrics.assistantTokenShare = totalTokens > 0 ? totalAssistantTokens / totalTokens : 0;

    const baselineModel = data.sourceId === 'chatgpt_export' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022';
    const price = lookupPrice(priceMap, baselineModel);
    if (price) {
      metrics.estimatedRelativeCostUsd = totalUserTokens * price.input_cost_per_token + totalAssistantTokens * price.output_cost_per_token;
      metrics.baselineModelAssumption = baselineModel;
    }
  }

  return metrics;
}

