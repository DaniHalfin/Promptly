import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CopilotPanel } from '../components/Results/panels/CopilotPanel';
import type { SourceMetrics, SourceReport } from '../types/index.js';

vi.mock('../components/Results/charts/ModelCostSharePie.js', () => ({
  ModelCostSharePie: ({ data }: { data: unknown[] }) => <div data-testid="model-cost-share-pie">{data.length} slices</div>,
}));

const baseMetrics: SourceMetrics = {
  sourceId: 'github_copilot',
  tier: 'B',
  periodStart: '2026-05-01',
  periodEnd: '2026-05-31',
  warnings: [],
  copilotGrossSpendUsd: 120,
  copilotDiscountUsd: 20,
  copilotNetSpendUsd: 100,
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
  copilotCostPerInteractionUsd: 0.1234,
  copilotAcceptanceRate: null,
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
  it('renders gross, discount, and net spend KPI tiles', () => {
    render(<CopilotPanel report={report()} />);

    expect(screen.getByText('Gross Spend')).toBeInTheDocument();
    expect(screen.getByText('$120.00')).toBeInTheDocument();
    expect(screen.getByText('Discount')).toBeInTheDocument();
    expect(screen.getByText('-$20.00')).toBeInTheDocument();
    expect(screen.getByText('Net Spend')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
  });

  it('renders model spend table sorted by net spend descending', () => {
    render(<CopilotPanel report={report()} />);

    const bodyRows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(within(bodyRows[0]).getByText('claude-sonnet-4')).toBeInTheDocument();
    expect(within(bodyRows[0]).getByText('$60.00')).toBeInTheDocument();
    expect(within(bodyRows[1]).getByText('gpt-4o')).toBeInTheDocument();
    expect(within(bodyRows[2]).getByText('gpt-4.1-mini')).toBeInTheDocument();
  });

  it('renders cost-per-interaction tile', () => {
    render(<CopilotPanel report={report()} />);

    expect(screen.getByText('Average net cost per interaction')).toBeInTheDocument();
    expect(screen.getByText('$0.1234')).toBeInTheDocument();
  });

  it('shows unavailable acceptance message when copilotAcceptanceRate is null', () => {
    render(<CopilotPanel report={report({ ...baseMetrics, copilotAcceptanceRate: null })} />);

    expect(screen.getByText(/acceptance rate unavailable/i)).toBeInTheDocument();
  });

  it('shows code completions label when copilotAcceptanceRate is a number', () => {
    render(<CopilotPanel report={report({ ...baseMetrics, copilotAcceptanceRate: 0.417 })} />);

    expect(screen.getByText('41.7%')).toBeInTheDocument();
    expect(screen.getByText(/code completions only/i)).toBeInTheDocument();
  });

  it('billing label includes that completions are not billed', () => {
    render(<CopilotPanel report={report()} />);

    expect(screen.getByText(/code completions are unlimited and not billed here/i)).toBeInTheDocument();
  });
});

