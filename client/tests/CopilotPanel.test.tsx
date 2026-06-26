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
  copilotNetSpendUsd: 100,
  copilotSessionCount: 42,
  copilotTotalInputTokens: 850_000,
  copilotTotalOutputTokens: 120_000,
  copilotSpendByModel: [
    { model: 'gpt-4o', netAmountUsd: 25, netSpendUsd: 25, spendShare: 0.25 },
    { model: 'claude-sonnet-4', netAmountUsd: 60, netSpendUsd: 60, spendShare: 0.6 },
    { model: 'gpt-4.1-mini', netAmountUsd: 15, netSpendUsd: 15, spendShare: 0.15 },
  ],
  copilotModelDistribution: [
    { model: 'gpt-4o', share: 0.25 },
    { model: 'claude-sonnet-4', share: 0.6 },
    { model: 'gpt-4.1-mini', share: 0.15 },
  ],
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
  it('renders net spend, session count, and total tokens KPI tiles', () => {
    render(<CopilotPanel report={report()} />);

    expect(screen.getByText('Net Spend')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Total Tokens')).toBeInTheDocument();
  });

  it('renders model spend table sorted by net spend descending', () => {
    render(<CopilotPanel report={report()} />);

    const bodyRows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(within(bodyRows[0]).getByText('claude-sonnet-4')).toBeInTheDocument();
    expect(within(bodyRows[0]).getByText('$60.00')).toBeInTheDocument();
    expect(within(bodyRows[1]).getByText('gpt-4o')).toBeInTheDocument();
    expect(within(bodyRows[2]).getByText('gpt-4.1-mini')).toBeInTheDocument();
  });

  it('renders input and output token tiles', () => {
    render(<CopilotPanel report={report()} />);

    expect(screen.getByText('Input tokens')).toBeInTheDocument();
    expect(screen.getByText('Output tokens')).toBeInTheDocument();
  });

  it('billing label includes that completions are not billed', () => {
    render(<CopilotPanel report={report()} />);

    expect(screen.getByText(/code completions are unlimited and not billed here/i)).toBeInTheDocument();
  });
});


