import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OpenAIPanel } from '../components/Results/panels/OpenAIPanel';
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
  sourceId: 'openai',
  tier: 'B',
  periodStart: '2026-05-01',
  periodEnd: '2026-05-31',
  warnings: [],
  totalActualSpendUsd: 80,
  avgDailySpendUsd: 2.58,
  modelBreakdown: [
    {
      model: 'gpt-4.1',
      estimatedCostShare: 0.75,
      estimatedCostUsd: 60,
      inputTokens: 2000,
      outputTokens: 1000,
      inputOutputRatio: 2,
      estimated: true,
    },
    {
      model: 'gpt-4.1-mini',
      estimatedCostShare: 0.25,
      estimatedCostUsd: 20,
      inputTokens: 1000,
      outputTokens: 500,
      inputOutputRatio: 2,
    },
  ],
};

function report(metrics: SourceMetrics = baseMetrics): SourceReport {
  return {
    source_id: 'openai',
    tier: 'B',
    connected: true,
    error: null,
    metrics,
  };
}

describe('OpenAIPanel', () => {
  it('renders estimated disclaimer text in model breakdown section', () => {
    render(<OpenAIPanel report={report()} />);

    expect(screen.getByText(/estimated model cost breakdown/i)).toBeInTheDocument();
    expect(screen.getByText(/exact per-model billing data is not available from the openai api/i)).toBeInTheDocument();
  });

  it('shows an indicator when a model breakdown entry is estimated', () => {
    render(<OpenAIPanel report={report()} />);

    expect(screen.getByText('* Estimated row')).toBeInTheDocument();
    expect(screen.getByTitle('Estimated model cost')).toHaveTextContent('*');
  });
});

