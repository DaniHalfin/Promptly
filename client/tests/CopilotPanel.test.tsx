import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CopilotPanel } from '../src/components/Results/panels/CopilotPanel';
import type { SourceMetrics, SourceReport } from '../src/types/index.js';

vi.mock('../components/Results/charts/ModelCostSharePie.js', () => ({
  ModelCostSharePie: ({ data }: { data: unknown[] }) => <div data-testid="model-cost-share-pie">{data.length} slices</div>,
}));

const baseMetrics: SourceMetrics = {
  sourceId: 'github_copilot',
  tier: 'B',
  periodStart: '2026-05-01',
  periodEnd: '2026-05-31',
  warnings: [],
  totalSpendUsd: 100,
  copilotTotalCostUsd: 100,
  copilotSessionCount: 42,
  copilotModelCostBreakdown: [
    { model: 'gpt-4o', costUsd: 25, costShare: 0.25 },
    { model: 'claude-sonnet-4', costUsd: 60, costShare: 0.6 },
    { model: 'gpt-4.1-mini', costUsd: 15, costShare: 0.15 },
  ],
  copilotTokenBreakdownByModel: [
    { model: 'claude-sonnet-4', inputTokens: 600000, outputTokens: 80000, cacheReadTokens: 120000, cacheWriteTokens: 50000, reasoningTokens: 5000, requestCount: 800, requestCost: 60 },
    { model: 'gpt-4o', inputTokens: 300000, outputTokens: 40000, cacheReadTokens: 60000, cacheWriteTokens: 20000, reasoningTokens: 0, requestCount: 400, requestCost: 25 },
    { model: 'gpt-4.1-mini', inputTokens: 200000, outputTokens: 30000, cacheReadTokens: 40000, cacheWriteTokens: 15000, reasoningTokens: 0, requestCount: 300, requestCost: 15 },
  ],
  copilotCachedTokenFraction: {
    aggregate: 0.18,
    perModel: [
      { model: 'claude-sonnet-4', fraction: 0.20 },
      { model: 'gpt-4o', fraction: 0.20 },
      { model: 'gpt-4.1-mini', fraction: 0.20 },
    ],
  },
};

function report(metrics: SourceMetrics = baseMetrics): SourceReport {
  return {
    source_id: 'github_copilot',
    tier: 'B',
    connected: true,
    error: null,
    metrics,
  };
}

describe('CopilotPanel', () => {
  it('renders total spend, session count, and total tokens KPI tiles', () => {
    render(<CopilotPanel report={report()} />);

    expect(screen.getByText('Total Spend')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Total Tokens')).toBeInTheDocument();
  });

  it('token breakdown table renders with all 8 column headers', () => {
    render(<CopilotPanel report={report()} />);

    const table = screen.getByTestId('token-breakdown-table');
    expect(within(table).getByText('Model')).toBeInTheDocument();
    expect(within(table).getByText('Input tokens')).toBeInTheDocument();
    expect(within(table).getByText('Output tokens')).toBeInTheDocument();
    expect(within(table).getByText('Cache read')).toBeInTheDocument();
    expect(within(table).getByText('Cache write')).toBeInTheDocument();
    expect(within(table).getByText('Reasoning')).toBeInTheDocument();
    expect(within(table).getByText('Requests')).toBeInTheDocument();
    expect(within(table).getByText('Cost (USD)')).toBeInTheDocument();
  });

  it('token breakdown table rows are sorted descending by requestCost', () => {
    render(<CopilotPanel report={report()} />);

    const table = screen.getByTestId('token-breakdown-table');
    const bodyRows = within(table).getAllByRole('row').slice(1);
    expect(within(bodyRows[0]).getByText('Claude Sonnet 4')).toBeInTheDocument();
    expect(within(bodyRows[1]).getByText('GPT-4o')).toBeInTheDocument();
    expect(within(bodyRows[2]).getByText('GPT-4.1 mini')).toBeInTheDocument();
  });

  it('renders model spend table sorted by costUsd descending', () => {
    render(<CopilotPanel report={report()} />);

    const tables = screen.getAllByRole('table');
    const modelSpendTable = tables[1];
    const bodyRows = within(modelSpendTable).getAllByRole('row').slice(1);
    expect(within(bodyRows[0]).getByText('Claude Sonnet 4')).toBeInTheDocument();
    expect(within(bodyRows[0]).getByText('$60.00')).toBeInTheDocument();
    expect(within(bodyRows[1]).getByText('GPT-4o')).toBeInTheDocument();
    expect(within(bodyRows[2]).getByText('GPT-4.1 mini')).toBeInTheDocument();
  });

  it('cache fraction tile renders with aggregate percentage', () => {
    render(<CopilotPanel report={report()} />);

    const tile = screen.getByTestId('cache-fraction-tile');
    expect(within(tile).getByText('Cache-read fraction (aggregate)')).toBeInTheDocument();
    expect(within(tile).getByText('18.0%')).toBeInTheDocument();
  });

  it('per-model cache fraction bars render', () => {
    render(<CopilotPanel report={report()} />);

    const bars = screen.getByTestId('cache-fraction-bars');
    expect(within(bars).getByText('Claude Sonnet 4')).toBeInTheDocument();
    expect(within(bars).getByText('GPT-4o')).toBeInTheDocument();
  });

  it('renders input and output token tiles', () => {
    render(<CopilotPanel report={report()} />);

    expect(screen.getAllByText('Input tokens').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Output tokens').length).toBeGreaterThanOrEqual(1);
  });

  it('billing label includes that completions are not billed', () => {
    render(<CopilotPanel report={report()} />);

    expect(screen.getByText(/code completions are unlimited and not billed here/i)).toBeInTheDocument();
  });

  it('renders gracefully when copilotTokenBreakdownByModel is absent', () => {
    const metricsWithoutBreakdown: SourceMetrics = { ...baseMetrics, copilotTokenBreakdownByModel: undefined };
    render(<CopilotPanel report={report(metricsWithoutBreakdown)} />);

    expect(screen.queryByTestId('token-breakdown-table')).not.toBeInTheDocument();
    expect(screen.getByText('Total Spend')).toBeInTheDocument();
  });

  it('renders gracefully when copilotCachedTokenFraction is absent', () => {
    const metricsWithoutCache: SourceMetrics = { ...baseMetrics, copilotCachedTokenFraction: undefined };
    render(<CopilotPanel report={report(metricsWithoutCache)} />);

    expect(screen.queryByTestId('cache-fraction-tile')).not.toBeInTheDocument();
    expect(screen.getByText('Total Spend')).toBeInTheDocument();
  });

  it('does not show Connected badge (badge removed from all result panels)', () => {
    render(<CopilotPanel report={report()} />);

    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
  });
});
