// ====== Source configuration (input to analysis) ======

export type SourceId =
  | 'openai'
  | 'anthropic'
  | 'github_copilot'
  | 'chatgpt_export'
  | 'claude_export'
  | 'claude_code';

export type Tier = 'A' | 'B' | 'C';

export interface SourceConfig {
  sourceId: SourceId;
  hasCredential: boolean;
  startDate?: string;       // ISO date YYYY-MM-DD
  endDate?: string;
  options?: Record<string, unknown>;
}

export interface AnalysisRequest {
  sources: SourceConfig[];
  files?: { sourceId: 'chatgpt_export' | 'claude_export'; filename: string }[];
}

// ====== Normalized usage data (adapter output, internal) ======

export interface NormalizedUsageRecord {
  date: string;             // ISO date YYYY-MM-DD
  model?: string;           // present for Tier B
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  costUsd?: number;
}

export interface NormalizedConversation {
  id: string;
  title?: string;
  createTime: string;
  updateTime: string;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  estimatedTotalTokens: number;
  estimatedUserTokens: number;
  estimatedAssistantTokens: number;
  multimodalPartsSkipped: number;
}

// ====== Copilot-specific normalized shapes ======

/** Per-session data extracted from session.shutdown events in events.jsonl.
 *  One entry per session.shutdown event within the analysis window. */
export interface NormalizedCopilotSession {
  date: string;
  sourceFile: string;
  models: Record<string, {
    requestCount: number;
    requestCost: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
  }>;
  totalCost: number;
}

export interface NormalizedSourceData {
  sourceId: SourceId;
  dailyTokensByModel?: NormalizedUsageRecord[];
  dailyCostUsd?: { date: string; costUsd: number }[];
  cachedTokensSupported?: boolean;
  conversations?: NormalizedConversation[];
  /** GitHub Copilot: per-session data from session.shutdown JSONL events. */
  copilotSessions?: NormalizedCopilotSession[];
  sessionCount?: number;
  claudeCodePeakHourFraction?: number;
  periodStart: string;
  periodEnd: string;
  /**
   * ChatGPT Export canonical pre-computed aggregates (Phase 1+).
   * Stored instead of raw conversations to preserve privacy.
   * Never contains message text, titles, or per-message content.
   */
  chatgptAggregates?: {
    total_conversations: number;
    total_messages: number;
    active_days: number;
    models_identified: string[];
    daily_conversation_activity: DailyConversationActivityEntry[];
    estimated_token_volume: number;
    estimated_user_tokens: number;
    estimated_assistant_tokens: number;
    newest_conversation_date?: string;
  };
}

export interface TierClassification {
  sourceId: SourceId;
  tier: Tier | null;
  /** Human-readable explanation of why this tier was assigned. */
  reason: string;
}

// ====== Tier and metrics ======

export interface ModelBreakdownEntry {
  model: string;
  estimatedCostShare: number;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  inputOutputRatio: number;
  estimated?: boolean;
}

export interface SourceMetrics {
  sourceId: SourceId;
  tier: Tier | null;
  periodStart: string;
  periodEnd: string;
  warnings: string[];

  // Tier B (OpenAI, Anthropic, Claude Code)
  totalActualSpendUsd?: number;
  dailySpend?: { date: string; spendUsd: number }[];
  modelBreakdown?: ModelBreakdownEntry[];
  aggregateInputOutputRatio?: number;
  efficiencySignal?: EfficiencySignal;
  cachedTokenFractionAnthropic?: number;
  cachedTokenSavingsUsdAnthropic?: number;
  cachedTokenFractionClaudeCode?: number;
  cachedTokenSavingsUsdClaudeCode?: number;
  avgDailySpendUsd?: number;
  peakSpendDay?: { date: string; spendUsd: number };
  rollingAvgSpend7dUsd?: number;
  momChangePct?: number | null;
  projectedR1SavingsUsd?: number;
  // Forward-looking projected savings if prompt caching is fully adopted.
  // Set for Anthropic and Claude Code sources only.
  totalActualTokens?: number;
  // Sum of (inputTokens + outputTokens) across all models for this source.
  // For Copilot: derived from copilotTokenBreakdownByModel.
  totalSpendUsd?: number;
  // Unified spend alias: equals totalActualSpendUsd for non-Copilot Tier B sources;
  // equals copilotTotalCostUsd for GitHub Copilot.
  avgDailyOutputTokensPerModel?: {
    model: string;
    avgDailyOutputTokens: number;
  }[];

  // Claude Code Tier B
  claudeCodeSessionCount?: number;
  claudeCodeAvgTokensPerSession?: number;
  claudeCodePeakHourFraction?: number;
  totalInputTokensClaudeCode?: number;
  cacheCreationInputTokensClaudeCode?: number;

  // Anthropic R1 trigger fields
  totalInputTokensAnthropic?: number;
  cacheCreationInputTokensAnthropic?: number;

  // GitHub Copilot Tier B
  copilotTotalCostUsd?: number;
  copilotModelCostBreakdown?: { model: string; costUsd: number; costShare: number; }[];
  copilotTokenBreakdownByModel?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
    requestCount: number;
    requestCost: number;
  }[];
  copilotCachedTokenFraction?: {
    perModel: { model: string; fraction: number }[];
    aggregate: number;
  };
  copilotSessionCount?: number;
  copilotAvgTokensPerSession?: number;
  // mean(Σ(inputTokens + outputTokens) per session) across all models.
  // cacheRead/cacheWrite are subsets of inputTokens, not additive.
  copilotDailyInputTokens?: { date: string; inputTokens: number }[];
  // Per-day Σ inputTokens across all models and sessions. Used by R3 getP90DailyInputTokens().

  // Tier C (file exports) — legacy camelCase fields (temporary migration compatibility)
  estimatedTotalTokens?: number;
  conversationCount?: number;
  avgConversationLengthTokens?: number;
  conversationLengthHistogram?: { bucket: string; count: number }[];
  longConversationFraction?: number;
  userTokenShare?: number;
  assistantTokenShare?: number;
  estimatedRelativeCostUsd?: number;
  baselineModelAssumption?: string;

  // Tier C canonical snake_case fields (spec v2.2 §7.19–§7.25)
  total_conversations?: number;
  total_messages?: number;
  active_days?: number;
  models_identified?: string[];
  estimated_relative_cost_usd?: number;
  daily_conversation_activity?: DailyConversationActivityEntry[];
  estimated_token_volume?: number;
  newest_conversation_date?: string;
  // Tier C trend and spike (computed by tierC.ts from daily_conversation_activity)
  trend?: TrendStatus;
  spike_callout?: SpikeCallout | null;
}

export interface EfficiencySignal {
  kind: 'input_heavy' | 'output_heavy' | 'balanced';
  headline: string;
  explanation: string;
  inputOutputRatio: number;
}

// ====== Tier C (ChatGPT Export) canonical types (spec v2.2 §7.19–§7.25) ======

export interface DailyConversationActivityEntry {
  date: string;
  conversation_count: number;
}

export type TrendStatus =
  | { status: 'available'; mom_change_pct: number; observed_days: number; required_days: number; message: string }
  | { status: 'insufficient_data'; observed_days: number; required_days: number; message: string }
  | { status: 'no_prior_spend'; observed_days: number; required_days: number; message: string };

export interface SpikeCallout {
  date: string;
  spend_usd?: number;
  conversation_count?: number;
  multiple_of_average: number;
  message: string;
}

export interface TierCChatGptExportMetrics {
  total_conversations: number;
  total_messages: number;
  active_days: number;
  models_identified: string[];
  estimated_relative_cost_usd: number;
  daily_conversation_activity: DailyConversationActivityEntry[];
  estimated_token_volume: number;
  trend: TrendStatus;
  spike_callout: SpikeCallout | null;
  newest_conversation_date?: string;
  total_spend_usd?: null;
  cache_savings_usd?: null;
  session_cost_usd?: null;
  dominant_model?: null;
}

export interface SourceReport {
  source_id: SourceId;
  tier: Tier | null;
  connected: boolean;
  error: string | null;
  metrics: SourceMetrics | null;
  warnings?: string[];
}

// ====== Recommendations ======

export type RecommendationId =
  | 'R1' | 'R2' | 'R3'
  | 'RC1' | 'RC3' | 'RC4a' | 'RC4b' | 'RC5' | 'RC6';

export interface RecommendationResult {
  id: RecommendationId;
  severity: 'High' | 'Medium' | 'Low';
  title: string;
  body: string;
  triggeringMetric: string;
  triggeringValue: number | string;
  estimatedSavingsUsd?: number | null;
  supportingChartRef?: { sourceId: SourceId; chartId: string };
  sourceIds: SourceId[];
  // Presentation metadata for progressive disclosure (ADR-9, spec §8)
  compactHeadline?: string;
  triggerSummary?: string;
  topSlotEligible?: boolean;
  targetSourceId?: SourceId;
  targetCardAnchor?: string;
  targetRecommendationAnchor?: string;
  savingsLabel?: string;
}

export interface TopRecommendationEntry {
  id: RecommendationId;
  title: string;
  compact_headline: string;
  source_id: SourceId;
  target_card_anchor: string;
  target_recommendation_anchor?: string;
  estimated_savings_usd: number;
  savings_label: string;
  severity: 'High' | 'Medium' | 'Low';
}

/** A computed §7 metric for inclusion in the report.
 *  Used internally; metrics are flattened onto SourceMetrics in the public report. */
export interface InsightResult {
  id: string;           // e.g. "7.4"
  sourceId: SourceId;
  label: string;
  value: number | string | object;
  unit?: 'usd' | 'tokens' | 'ratio' | 'percent' | 'date' | 'count';
  estimated: boolean;
}

// ====== Full report (export schema) ======

export interface AnalysisReportMetadata {
  generated_at: string;
  analysis_period_start: string;
  analysis_period_end: string;
  promptly_version: string;
  litellm_price_map_date: string;
}

// ====== Cross-source summary types ======

export interface DailySpendEntry {
  date: string;
  spend_usd: number;
  includes_estimated_tier_c?: boolean;
}

export interface SpendByToolEntry {
  source_id: SourceId;
  display_name: string;
  estimated_spend_usd: number;
  percentage_of_total: number;
  tier: Tier | null;
  is_estimated: boolean;
  estimate_label?: string;
  rank: number;
}

export interface CrossSourceSummary {
  total_actual_spend_usd: number;
  total_estimated_spend_usd: number;
  total_actual_tokens: number;
  total_estimated_tokens: number;
  effective_cost_per_million_tokens_usd?: number | null;
  daily_spend: DailySpendEntry[];
  spend_by_tool: SpendByToolEntry[];
  trend: TrendStatus;
  spike_callout: SpikeCallout | null;
  includes_estimates?: boolean;
  allSourcesFailed?: boolean;
  top_recommendations?: TopRecommendationEntry[];
  /** The single highest-priority recommendation across all rule outputs (computed post-generate). */
  top_recommendation?: {
    id: RecommendationId;
    title: string;
    priority: 'high' | 'medium' | 'low';
  } | null;
}

export interface AnalysisReport {
  metadata: AnalysisReportMetadata;
  sources: SourceReport[];
  cross_source_summary: CrossSourceSummary;
  recommendations: RecommendationResult[];
  assumptions: string[];
}
