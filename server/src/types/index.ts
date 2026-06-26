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
  date: string;         // ISO date (local TZ) derived from sessionStartTime
  sourceFile: string;   // path for diagnostics
  models: Record<string, {
    requestCount: number;
    requestCost: number;       // AI credit units (USD float)
    inputTokens: number;       // TOTAL; cacheRead/cacheWrite are subsets
    outputTokens: number;      // TOTAL; reasoningTokens is a subset
    cacheReadTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
  }>;
  totalCost: number;    // raw totalPremiumRequests from the shutdown event — preserved as cross-check against per-model sum
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
  cachedTokenFractionAnthropic?: number;
  cachedTokenSavingsUsdAnthropic?: number;
  cachedTokenFractionClaudeCode?: number;
  cachedTokenSavingsUsdClaudeCode?: number;
  avgDailySpendUsd?: number;
  peakSpendDay?: { date: string; spendUsd: number };
  rollingAvgSpend7dUsd?: number;
  momChangePct?: number | null;
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

  // Tier C (file exports)
  estimatedTotalTokens?: number;
  conversationCount?: number;
  avgConversationLengthTokens?: number;
  conversationLengthHistogram?: { bucket: string; count: number }[];
  longConversationFraction?: number;
  userTokenShare?: number;
  assistantTokenShare?: number;
  estimatedRelativeCostUsd?: number;
  baselineModelAssumption?: string;
}

export interface SourceReport {
  source_id: SourceId;
  tier: Tier | null;
  connected: boolean;
  error: string | null;
  metrics: SourceMetrics | null;
}

// ====== Recommendations ======

export type RecommendationId = 'R1' | 'R2' | 'R3' | 'R4';

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
}

// ====== Full report (export schema) ======

export interface AnalysisReportMetadata {
  generated_at: string;
  analysis_period_start: string;
  analysis_period_end: string;
  promptly_version: string;
  litellm_price_map_date: string;
}

export interface CrossSourceSummary {
  total_actual_spend_usd: number;
  total_estimated_spend_usd: number;
  total_actual_tokens: number;
  total_estimated_tokens: number;
  allSourcesFailed?: boolean;
}

export interface AnalysisReport {
  metadata: AnalysisReportMetadata;
  sources: SourceReport[];
  cross_source_summary: CrossSourceSummary;
  recommendations: RecommendationResult[];
  assumptions: string[];
}

