import { Tier } from '../types/index.js';
import { NormalizedSourceData } from '../types/index.js';

export function classifyTier(data: NormalizedSourceData | null): Tier | null {
  if (!data) return null;

  // Tier B: GitHub Copilot session data contains actual billable usage/cost.
  if (data.sourceId === 'github_copilot' && data.copilotSessions?.length) {
    return 'B';
  }

  // Tier B: has both tokens and cost data (daily buckets)
  if (data.dailyTokensByModel?.length && data.dailyCostUsd?.length) {
    return 'B';
  }

  // Tier C: has tokens, conversation data, or canonical ChatGPT aggregates
  if (data.dailyTokensByModel?.length || data.conversations?.length || data.chatgptAggregates) {
    return 'C';
  }

  return null;
}
