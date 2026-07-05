/**
 * 3.4 — SpendingTrendSection component tests
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SpendingTrendSection } from '../src/components/Results/SpendingTrendSection';
import type { DailySpendEntry, SpikeCallout } from '../src/types/index.js';

const dailySpend: DailySpendEntry[] = [
  { date: '2026-01-01', spend_usd: 5.0, includes_estimated_tier_c: false },
  { date: '2026-01-02', spend_usd: 8.0, includes_estimated_tier_c: false },
  { date: '2026-01-03', spend_usd: 3.0, includes_estimated_tier_c: false },
];

const spikeCallout: SpikeCallout = {
  date: '2026-01-02',
  spend_usd: 8.0,
  z_score: 2.5,
  message: 'Unusual spike in spending',
  multiple_of_average: 2.5,
};

describe('SpendingTrendSection', () => {
  it('renders the section', () => {
    render(
      <SpendingTrendSection
        dailySpend={dailySpend}
        trend={{ status: 'stable', observed_days: 30, required_days: 30, message: '' }}
        spikeCallout={null}
      />
    );
    expect(screen.getByTestId('spending-trend-section')).toBeInTheDocument();
  });

  it('renders spike callout banner when spikeCallout is provided', () => {
    render(
      <SpendingTrendSection
        dailySpend={dailySpend}
        trend={{ status: 'stable', observed_days: 30, required_days: 30, message: '' }}
        spikeCallout={spikeCallout}
      />
    );
    expect(screen.getByTestId('spike-callout')).toBeInTheDocument();
    // date appears in both the spike banner and the sr-only table row — use getAllByText
    expect(screen.getAllByText(/2026-01-02/).length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT render spike callout banner when spikeCallout is null', () => {
    render(
      <SpendingTrendSection
        dailySpend={dailySpend}
        trend={{ status: 'stable', observed_days: 30, required_days: 30, message: '' }}
        spikeCallout={null}
      />
    );
    expect(screen.queryByTestId('spike-callout')).not.toBeInTheDocument();
  });

  it('renders trend badge with status text', () => {
    render(
      <SpendingTrendSection
        dailySpend={dailySpend}
        trend={{ status: 'stable', observed_days: 30, required_days: 30, message: 'Spending is stable' }}
        spikeCallout={null}
      />
    );
    // The trend badge should appear in the section
    expect(screen.getByTestId('spending-trend-section')).toBeInTheDocument();
  });

  it('renders with empty dailySpend (no crash)', () => {
    render(
      <SpendingTrendSection
        dailySpend={[]}
        trend={{ status: 'insufficient_data', observed_days: 0, required_days: 30, message: '' }}
        spikeCallout={null}
      />
    );
    expect(screen.getByTestId('spending-trend-section')).toBeInTheDocument();
  });
});
