import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnthropicPanel } from '../components/Results/panels/AnthropicPanel';
import type { SourceMetrics, SourceReport } from '../types/index.js';

vi.mock('../components/Results/charts/DailySpendLine.js', () => ({
  DailySpendLine: () => <div data-testid="daily-spend-line" />,
}));
vi.mock('../components/Results/charts/ModelCostSharePie.js', () => ({
  ModelCostSharePie: () => <div data-testid="model-cost-share-pie" />,
}));
vi.mock('../components/Results/charts/TokenRatioBar.js', () => ({
  TokenRatioBar: () => <div data-testid="token-ratio-bar" />,
}));

const baseMetrics: SourceMetrics = {
  sourceId: 'anthropic',
  tier: 'B',
  periodStart: '2026-05-01',
  periodEnd: '2026-05-31',
  warnings: [],
  totalActualSpendUsd: 55,
  avgDailySpendUsd: 1.77,
  modelBreakdown: [
    {
      model: 'claude-3-5-sonnet',
      estimatedCostShare: 1,
      estimatedCostUsd: 55,
      inputTokens: 1000,
      outputTokens: 500,
      cachedInputTokens: 250,
      inputOutputRatio: 2,
    },
  ],
  cachedTokenFractionAnthropic: 0.25,
  cachedTokenSavingsUsdAnthropic: 6.5,
};

function report(metrics: SourceMetrics = baseMetrics): SourceReport {
  return {
    source_id: 'anthropic',
    tier: 'B',
    connected: true,
    error: null,
    metrics,
  };
}

describe('AnthropicPanel', () => {
  it('renders cachedTokenFractionAnthropic instead of a generic cachedTokenFraction', () => {
    render(<AnthropicPanel report={report({ ...baseMetrics, cachedTokenFraction: 0.9 } as SourceMetrics & { cachedTokenFraction: number })} />);

    expect(screen.getByText(/prompt cache savings/i)).toBeInTheDocument();
    expect(screen.getByText(/25.0% of tokens/i)).toBeInTheDocument();
    expect(screen.queryByText(/90.0% of tokens/i)).not.toBeInTheDocument();
  });

  it('does not render cache section when cachedTokenFractionAnthropic is undefined', () => {
    const { cachedTokenFractionAnthropic, ...metrics } = baseMetrics;
    render(<AnthropicPanel report={report(metrics)} />);

    expect(screen.queryByText(/prompt cache savings/i)).not.toBeInTheDocument();
  });
});

