/**
 * 3.4 — ToolSpendCard component tests
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ToolSpendCard } from '../src/components/Results/ToolSpendCard';
import type { SourceReport, SpendByToolEntry, RecommendationResult } from '../src/types/index.js';

// Mock DailyConversationActivityLine to detect when it renders
vi.mock('../src/components/Results/DailyConversationActivityLine.js', () => ({
  DailyConversationActivityLine: ({ data }: { data: unknown[] }) => (
    <div data-testid="daily-conversation-activity-line" data-count={data.length} />
  ),
}));

const makeSource = (
  sourceId: string,
  tier: 'B' | 'C',
  extraMetrics?: Record<string, unknown>
): SourceReport => ({
  source_id: sourceId as any,
  tier,
  connected: true,
  error: null,
  metrics: {
    sourceId: sourceId as any,
    tier,
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    warnings: [],
    ...extraMetrics,
  } as any,
});

const openaiSource = makeSource('openai', 'B', { totalActualSpendUsd: 80 });
const chatgptSource = makeSource('chatgpt_export', 'C', {
  total_conversations: 50,
  total_messages: 250,
  active_days: 20,
  models_identified: ['gpt-4o'],
  estimated_relative_cost_usd: 12.5,
  daily_conversation_activity: [
    { date: '2026-01-01', conversation_count: 5 },
    { date: '2026-01-02', conversation_count: 3 },
  ],
  estimated_token_volume: 100000,
});

const spendEntry: SpendByToolEntry = {
  source_id: 'openai' as any,
  display_name: 'OpenAI',
  rank: 1,
  estimated_spend_usd: 80,
  percentage_of_total: 100,
  tier: 'B',
  is_estimated: false,
};

const recs: RecommendationResult[] = [
  {
    id: 'R1' as any,
    title: 'Enable prompt caching',
    body: 'Cache repeated system prompts.',
    priority: 'High' as any,
    severity: 'High',
    sourceIds: ['openai' as any],
  },
];

describe('ToolSpendCard', () => {
  it('renders with data-testid for each source', () => {
    render(<ToolSpendCard source={openaiSource} recommendations={[]} />);
    expect(screen.getByTestId('tool-spend-card-openai')).toBeInTheDocument();
  });

  it('renders source display name', () => {
    render(<ToolSpendCard source={openaiSource} recommendations={[]} />);
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
  });

  it('renders spend from spendEntry', () => {
    render(<ToolSpendCard source={openaiSource} recommendations={[]} spendEntry={spendEntry} />);
    expect(screen.getByText('$80.00')).toBeInTheDocument();
  });

  it('renders source-scoped recommendations', () => {
    render(<ToolSpendCard source={openaiSource} recommendations={recs} />);
    expect(screen.getByText('Enable prompt caching')).toBeInTheDocument();
  });

  it('renders DailyConversationActivityLine for chatgpt_export (Tier C)', () => {
    render(<ToolSpendCard source={chatgptSource} recommendations={[]} />);
    expect(screen.getByTestId('daily-conversation-activity-line')).toBeInTheDocument();
  });

  it('does NOT render DailyConversationActivityLine for Tier B sources (e.g. openai)', () => {
    render(<ToolSpendCard source={openaiSource} recommendations={[]} />);
    expect(screen.queryByTestId('daily-conversation-activity-line')).not.toBeInTheDocument();
  });

  it('renders models list when models_identified present', () => {
    render(<ToolSpendCard source={chatgptSource} recommendations={[]} />);
    expect(screen.getByText('gpt-4o')).toBeInTheDocument();
  });

  it('renders error message when source has error', () => {
    const errSource: SourceReport = {
      source_id: 'openai' as any,
      tier: 'B',
      connected: false,
      error: 'Invalid API key',
      metrics: null,
    };
    render(<ToolSpendCard source={errSource} recommendations={[]} />);
    expect(screen.getByText(/Invalid API key/)).toBeInTheDocument();
  });
});
