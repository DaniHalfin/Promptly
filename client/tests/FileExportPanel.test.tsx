/**
 * 3.5 — FileExportPanel tests: canonical Tier C fields
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FileExportPanel } from '../src/components/Results/panels/FileExportPanel';
import type { SourceReport } from '../src/types/index.js';

// Mock sub-components
vi.mock('../src/components/Results/DailyConversationActivityLine.js', () => ({
  DailyConversationActivityLine: () => <div data-testid="daily-activity-chart" />,
}));
vi.mock('../src/components/common/TierUpgradeNudge.js', () => ({
  TierUpgradeNudge: () => null,
}));

const makeReport = (overrides?: Record<string, unknown>): SourceReport => ({
  source_id: 'chatgpt_export' as any,
  tier: 'C',
  connected: true,
  error: null,
  metrics: {
    sourceId: 'chatgpt_export' as any,
    tier: 'C',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    warnings: [],
    total_conversations: 42,
    total_messages: 210,
    active_days: 18,
    models_identified: ['gpt-4o', 'gpt-4o-mini'],
    estimated_relative_cost_usd: 7.5,
    daily_conversation_activity: [
      { date: '2026-01-01', conversation_count: 3 },
      { date: '2026-01-02', conversation_count: 5 },
    ],
    estimated_token_volume: 88000,
    ...overrides,
  } as any,
});

describe('FileExportPanel — canonical Tier C fields', () => {
  it('renders total_conversations', () => {
    render(<FileExportPanel report={makeReport()} />);
    expect(screen.getByText('Total Conversations')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders total_messages', () => {
    render(<FileExportPanel report={makeReport()} />);
    expect(screen.getByText('Total Messages')).toBeInTheDocument();
    expect(screen.getByText('210')).toBeInTheDocument();
  });

  it('renders active_days', () => {
    render(<FileExportPanel report={makeReport()} />);
    expect(screen.getByText('Active Days')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('renders derived avg messages / conversation (not stored)', () => {
    render(<FileExportPanel report={makeReport()} />);
    // 210 / 42 = 5
    expect(screen.getByText('Avg Messages / Conversation')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders models_identified list', () => {
    render(<FileExportPanel report={makeReport()} />);
    expect(screen.getByText('gpt-4o')).toBeInTheDocument();
    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
  });

  it('renders estimated_relative_cost_usd with ~ prefix and (estimated) label', () => {
    render(<FileExportPanel report={makeReport()} />);
    // ~ prefix on the dollar value
    expect(screen.getByText('~$7.50')).toBeInTheDocument();
    // (estimated) label appears (at least once — both cost and token fields have it)
    expect(screen.getAllByText('(estimated)').length).toBeGreaterThanOrEqual(1);
  });

  it('renders estimated_token_volume with ~ prefix and (estimated) label', () => {
    render(<FileExportPanel report={makeReport()} />);
    // The token volume with ~ prefix
    expect(screen.getByText('~88,000')).toBeInTheDocument();
    // Two (estimated) labels should be present (one for each estimated field)
    const labels = screen.getAllByText('(estimated)');
    expect(labels.length).toBeGreaterThanOrEqual(2);
  });

  it('renders DailyConversationActivityLine when daily_conversation_activity is non-empty', () => {
    render(<FileExportPanel report={makeReport()} />);
    expect(screen.getByTestId('daily-activity-chart')).toBeInTheDocument();
  });

  it('shows zero-data state when total_conversations=0 and estimated_token_volume=0', () => {
    const zeroReport = makeReport({ total_conversations: 0, estimated_token_volume: 0 });
    render(<FileExportPanel report={zeroReport} />);
    expect(screen.getByText(/No conversations found/)).toBeInTheDocument();
  });

  it('shows no-metrics state when metrics is null', () => {
    const nullReport: SourceReport = {
      source_id: 'chatgpt_export' as any,
      tier: 'C',
      connected: false,
      error: null,
      metrics: null,
    };
    render(<FileExportPanel report={nullReport} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  // Verify NO legacy camelCase fields are rendered
  it('does not render legacy conversationCount field', () => {
    render(<FileExportPanel report={makeReport()} />);
    expect(screen.queryByText('conversationCount')).not.toBeInTheDocument();
    expect(screen.queryByText('Conversations')).not.toBeInTheDocument(); // old label was just "Conversations"
  });

  it('does not render legacy estimatedTotalTokens field label', () => {
    render(<FileExportPanel report={makeReport()} />);
    expect(screen.queryByText('Total Tokens')).not.toBeInTheDocument(); // old label
    expect(screen.queryByText('estimatedTotalTokens')).not.toBeInTheDocument();
  });
});
