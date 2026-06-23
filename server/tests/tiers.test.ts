import { describe, expect, it } from 'vitest';
import { classifyTier } from '../src/engine/tiers.js';
import type { NormalizedSourceData } from '../src/types/index.js';

const base = (overrides: Partial<NormalizedSourceData>): NormalizedSourceData => ({
  sourceId: 'anthropic',
  periodStart: '2026-06-01T00:00:00Z',
  periodEnd: '2026-06-02T00:00:00Z',
  ...overrides,
});

describe('classifyTier', () => {
  it('classifies daily tokens plus daily costs as Tier B', () => {
    expect(classifyTier(base({
      dailyTokensByModel: [{ date: '2026-06-01', model: 'claude', inputTokens: 10, outputTokens: 5 }],
      dailyCostUsd: [{ date: '2026-06-01', costUsd: 1.23 }],
    }))).toBe('B');
  });

  it('classifies Copilot billing data as Tier B', () => {
    expect(classifyTier(base({
      sourceId: 'github_copilot',
      copilotBillingItems: [{
        date: '2026-06-01',
        product: 'copilot',
        model: 'gpt-5.4',
        pricePerUnit: 1,
        grossQuantity: 1,
        grossAmountUsd: 8,
        discountAmountUsd: 2,
        netAmountUsd: 6,
      }],
    }))).toBe('B');
  });

  it('classifies conversation export shape as Tier C', () => {
    expect(classifyTier(base({
      sourceId: 'chatgpt_export',
      conversations: [{
        id: 'c1',
        createTime: '2026-06-01T00:00:00Z',
        updateTime: '2026-06-01T00:10:00Z',
        messageCount: 2,
        userMessageCount: 1,
        assistantMessageCount: 1,
        estimatedTotalTokens: 100,
        estimatedUserTokens: 40,
        estimatedAssistantTokens: 60,
        multimodalPartsSkipped: 0,
      }],
    }))).toBe('C');
  });

  it('returns null for null or undefined input', () => {
    expect(classifyTier(null)).toBeNull();
    expect(classifyTier(undefined as unknown as NormalizedSourceData | null)).toBeNull();
  });

  it('does not classify empty daily token buckets without cost data as Tier B', () => {
    expect(classifyTier(base({ dailyTokensByModel: [] }))).not.toBe('B');
  });
});

