import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PrintLayout } from '../src/components/export/PrintLayout';
import type { AnalysisReport } from '../src/types/index.js';

const report: AnalysisReport = {
  metadata: {
    generated_at: '2026-06-22T12:00:00.000Z',
    analysis_period_start: '2026-05-23',
    analysis_period_end: '2026-06-22',
    promptly_version: '0.1.0',
    litellm_price_map_date: '2026-06-01',
  },
  sources: [
    {
      source_id: 'github_copilot',
      tier: 'B',
      connected: true,
      error: null,
      metrics: {
        sourceId: 'github_copilot',
        tier: 'B',
        periodStart: '2026-05-23',
        periodEnd: '2026-06-22',
        warnings: [],
        totalSpendUsd: 85.25,
        totalActualTokens: 2530000,
        copilotTotalCostUsd: 99.99,
        copilotSessionCount: 89,
      },
    },
  ],
  cross_source_summary: {
    total_actual_spend_usd: 123.45,
    total_estimated_spend_usd: 0,
    total_actual_tokens: 2530000,
    total_estimated_tokens: 0,
  },
  recommendations: [],
  assumptions: [],
};

describe('PrintLayout', () => {
  it('renders unified totalSpendUsd and totalActualTokens in per-source metrics', () => {
    render(<PrintLayout report={report} />);

    const totalSpendLabel = screen.getByText('TOTAL SPEND');
    expect(totalSpendLabel.parentElement).not.toBeNull();
    expect(within(totalSpendLabel.parentElement as HTMLElement).getByText('$85.25')).toBeInTheDocument();

    const totalTokensLabel = screen.getByText('TOTAL TOKENS');
    expect(totalTokensLabel.parentElement).not.toBeNull();
    expect(within(totalTokensLabel.parentElement as HTMLElement).getByText('2,530,000')).toBeInTheDocument();
  });
});
