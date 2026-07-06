import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModelSpendMiniBar } from '../src/components/Results/ModelSpendMiniBar';
import type { SourceReport } from '../src/types/index.js';

function sourceWithRows(rows: Array<{ model: string; share: number; cost: number }>): SourceReport {
  return {
    source_id: 'anthropic',
    tier: 'B',
    connected: true,
    error: null,
    metrics: {
      sourceId: 'anthropic',
      tier: 'B',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      warnings: [],
      modelBreakdown: rows.map(row => ({
        model: row.model,
        estimatedCostShare: row.share,
        estimatedCostUsd: row.cost,
        inputTokens: 10,
        outputTokens: 5,
        inputOutputRatio: 2,
      })),
    },
  };
}

describe('ModelSpendMiniBar', () => {
  it('renders dominant model sentence with rounded percentage', () => {
    render(<ModelSpendMiniBar source={sourceWithRows([{ model: 'claude-3-5-sonnet', share: 0.674, cost: 12.34 }])} />);
    expect(screen.getByText(/Most of your Anthropic spend went to/)).toBeInTheDocument();
    expect(screen.getAllByText('claude-3-5-sonnet')[0]).toBeInTheDocument();
    expect(screen.getByText(/\(67%\)/)).toBeInTheDocument();
  });

  it('renders one horizontal bar per model sorted by cost share', () => {
    render(<ModelSpendMiniBar source={sourceWithRows([
      { model: 'small', share: 0.2, cost: 2 },
      { model: 'large', share: 0.8, cost: 8 },
    ])} />);

    const rows = screen.getAllByTestId(/model-spend-row-/);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('data-testid', 'model-spend-row-large');
    expect(rows[1]).toHaveAttribute('data-testid', 'model-spend-row-small');
  });

  it('renders <0.1% for nonzero tiny shares', () => {
    render(<ModelSpendMiniBar source={sourceWithRows([{ model: 'tiny', share: 0.0005, cost: 0.01 }])} />);
    expect(screen.getAllByText('<0.1%')[0]).toBeInTheDocument();
  });

  it('renders an sr-only table with model, spend, and percentage', () => {
    render(<ModelSpendMiniBar source={sourceWithRows([{ model: 'large', share: 0.8, cost: 8 }])} />);
    expect(screen.getByRole('table', { name: 'Model cost share' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Model' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Spend' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Percentage' })).toBeInTheDocument();
  });

  it('does not render when rows are empty', () => {
    const { container } = render(<ModelSpendMiniBar source={sourceWithRows([])} />);
    expect(container).toBeEmptyDOMElement();
  });
});
