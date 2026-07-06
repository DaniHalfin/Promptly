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

  it('does not expose Tier B or Tier C labels', () => {
    const { container } = render(<ToolSpendCard source={openaiSource} recommendations={[]} spendEntry={spendEntry} />);
    expect(container.textContent).not.toMatch(/Tier\s+[BC]\b/);
  });

  it('renders spend without tilde or estimated sublabel', () => {
    const { container } = render(<ToolSpendCard source={chatgptSource} recommendations={[]} />);
    // Tier C spend renders as a plain figure with a "Spend" label — no ~, no "estimated"
    expect(screen.getByText('$12.50')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/~/);
    expect(container.textContent).not.toMatch(/estimated/i);
  });

  it('renders model spend mini-bar from copilotModelCostBreakdown fallback', () => {
    const copilotSource = makeSource('github_copilot', 'B', {
      copilotTotalCostUsd: 42,
      copilotSessionCount: 3,
      totalActualTokens: 1500,
      copilotModelCostBreakdown: [
        { model: 'gpt-5.4', costUsd: 30, costShare: 0.7 },
        { model: 'gpt-5.4-mini', costUsd: 12, costShare: 0.3 },
      ],
    });
    render(<ToolSpendCard source={copilotSource} recommendations={[]} />);
    expect(screen.getByTestId('model-spend-mini-bar')).toBeInTheDocument();
    expect(screen.getAllByText('gpt-5.4')[0]).toBeInTheDocument();
    expect(screen.getAllByText('gpt-5.4-mini')[0]).toBeInTheDocument();
  });

  it('renders mini spend trend when dailySpend exists (Tier B)', () => {
    const tierBWithTrend = makeSource('openai', 'B', {
      totalActualSpendUsd: 50,
      dailySpend: [
        { date: '2026-01-01', spendUsd: 20 },
        { date: '2026-01-02', spendUsd: 30 },
      ],
    });
    render(<ToolSpendCard source={tierBWithTrend} recommendations={[]} />);
    expect(screen.getByTestId('spend-trend-openai')).toBeInTheDocument();
    // Tier B must NOT render the conversation activity line
    expect(screen.queryByTestId('daily-conversation-activity-line')).not.toBeInTheDocument();
  });

  it('renders source-specific key metrics without calculation caveats', () => {
    const copilotSource = makeSource('github_copilot', 'B', {
      copilotTotalCostUsd: 42,
      copilotSessionCount: 4,
      totalActualTokens: 2000,
      copilotAvgTokensPerSession: 500,
    });
    const { container } = render(<ToolSpendCard source={copilotSource} recommendations={[]} />);
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Total tokens')).toBeInTheDocument();
    // No calculation-caveat copy
    expect(container.textContent).not.toMatch(/estimated/i);
    expect(container.textContent).not.toMatch(/\(est\.\)/);
  });
});

describe('ToolSpendCard EfficiencySignalCallout', () => {
  it('renders the efficiency callout for Tier B sources with signal data', () => {
    const source = makeSource('openai', 'B', {
      totalActualSpendUsd: 12,
      efficiencySignal: {
        kind: 'input_heavy',
        headline: 'Input-heavy usage',
        explanation: 'Most of your cost came from sending context, not getting answers.',
        inputOutputRatio: 10,
      },
    });

    render(<ToolSpendCard source={source} recommendations={[]} />);
    expect(screen.getByTestId('efficiency-signal-callout')).toBeInTheDocument();
    expect(screen.getByText('Input-heavy usage')).toBeInTheDocument();
  });

  it('does not render the efficiency callout for Tier C sources', () => {
    const source = makeSource('chatgpt_export', 'C', {
      estimated_relative_cost_usd: 4,
      efficiencySignal: {
        kind: 'input_heavy',
        headline: 'Input-heavy usage',
        explanation: 'Most of your cost came from sending context, not getting answers.',
        inputOutputRatio: 10,
      },
    });

    render(<ToolSpendCard source={source} recommendations={[]} />);
    expect(screen.queryByTestId('efficiency-signal-callout')).not.toBeInTheDocument();
  });
});

describe('ToolSpendCard ModelSpendMiniBar', () => {
  it('renders model spend mini-bar for Tier B modelBreakdown', () => {
    const source = makeSource('anthropic', 'B', {
      totalActualSpendUsd: 20,
      modelBreakdown: [
        { model: 'claude-3-5-sonnet', estimatedCostShare: 0.7, estimatedCostUsd: 14, inputTokens: 10, outputTokens: 5, inputOutputRatio: 2 },
        { model: 'claude-3-haiku', estimatedCostShare: 0.3, estimatedCostUsd: 6, inputTokens: 10, outputTokens: 5, inputOutputRatio: 2 },
      ],
    });

    render(<ToolSpendCard source={source} recommendations={[]} />);
    expect(screen.getByTestId('model-spend-mini-bar')).toBeInTheDocument();
    expect(screen.getByText(/Most of your Anthropic spend went to/)).toBeInTheDocument();
  });

  it('renders model spend mini-bar for GitHub Copilot cost breakdown', () => {
    const source = makeSource('github_copilot', 'B', {
      copilotTotalCostUsd: 20,
      copilotModelCostBreakdown: [
        { model: 'gpt-5.4', costUsd: 15, costShare: 0.75 },
        { model: 'gpt-5.4-mini', costUsd: 5, costShare: 0.25 },
      ],
    });

    render(<ToolSpendCard source={source} recommendations={[]} />);
    expect(screen.getByTestId('model-spend-mini-bar')).toBeInTheDocument();
    expect(screen.getByText(/Most of your GitHub Copilot spend went to/)).toBeInTheDocument();
  });

  it('does not render model spend mini-bar for ChatGPT Export', () => {
    render(<ToolSpendCard source={chatgptSource} recommendations={[]} />);
    expect(screen.queryByTestId('model-spend-mini-bar')).not.toBeInTheDocument();
  });
});
