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
  message: 'Spike detected on 2026-01-02: $8.00 (2.5× daily average of $3.20).',
  multiple_of_average: 2.5,
};

describe('SpendingTrendSection', () => {
  it('renders the section', () => {
    render(
      <SpendingTrendSection
        dailySpend={dailySpend}
        trend={{ status: 'insufficient_data', observed_days: 30, required_days: 30, message: '' }}
        spikeCallout={null}
      />
    );
    expect(screen.getByTestId('spending-trend-section')).toBeInTheDocument();
  });

  it('renders spike title and a non-duplicative spend body', () => {
    const { container } = render(
      <SpendingTrendSection
        dailySpend={dailySpend}
        trend={{ status: 'insufficient_data', observed_days: 30, required_days: 30, message: '' }}
        spikeCallout={spikeCallout}
      />
    );

    const callout = screen.getByTestId('spike-callout');
    expect(callout).toBeInTheDocument();
    expect(screen.getByText('Spike detected on 2026-01-02')).toBeInTheDocument();
    expect(screen.getByText('$8.00 spent — 2.5× your daily average of $3.20')).toBeInTheDocument();
    expect(callout.textContent).not.toMatch(/Spike detected on 2026-01-02Spike detected/);
    expect(callout.querySelectorAll('p')[1]?.textContent).not.toMatch(/^Spike detected/);
    expect(container.textContent).toContain('2.5×');
  });

  it('badge reads "last {window_days}d vs prior {window_days}d" — P4', () => {
    render(
      <SpendingTrendSection
        dailySpend={dailySpend}
        trend={{ status: 'available', mom_change_pct: 404.2, observed_days: 30, required_days: 30, window_days: 30, message: '' }}
        spikeCallout={null}
      />
    );

    expect(screen.getByText(/404\.2%.*last 30d vs prior 30d/)).toBeInTheDocument();
    expect(screen.queryByText(/MoM/)).not.toBeInTheDocument();
  });

  it('badge shows window_days (30), not observed_days (60), when user has 60 days of data — P4 regression', () => {
    render(
      <SpendingTrendSection
        dailySpend={dailySpend}
        trend={{ status: 'available', mom_change_pct: -5.0, observed_days: 60, required_days: 60, window_days: 30, message: '' }}
        spikeCallout={null}
      />
    );
    expect(screen.getByText(/5\.0%.*last 30d vs prior 30d/)).toBeInTheDocument();
    expect(screen.queryByText(/prior 60/)).not.toBeInTheDocument();
  });

  it('does NOT render spike callout banner when spikeCallout is null', () => {
    render(
      <SpendingTrendSection
        dailySpend={dailySpend}
        trend={{ status: 'insufficient_data', observed_days: 30, required_days: 30, message: '' }}
        spikeCallout={null}
      />
    );
    expect(screen.queryByTestId('spike-callout')).not.toBeInTheDocument();
  });

  it('renders trend badge with status text', () => {
    render(
      <SpendingTrendSection
        dailySpend={dailySpend}
        trend={{ status: 'insufficient_data', observed_days: 30, required_days: 30, message: 'Spending is stable' }}
        spikeCallout={null}
      />
    );
    // The trend badge should appear in the section
    expect(screen.getByTestId('spending-trend-section')).toBeInTheDocument();
  });

  it('renders DailySpendLine when dailySpend has entries', () => {
    render(
      <SpendingTrendSection
        dailySpend={dailySpend}
        trend={{ status: 'insufficient_data', observed_days: 30, required_days: 30, message: '' }}
        spikeCallout={null}
      />
    );
    // The wired DailySpendLine renders a <figure> labelled "Daily spend over time"
    expect(screen.getByLabelText(/Daily spend over time/i)).toBeInTheDocument();
    expect(screen.queryByTestId('spending-trend-empty')).not.toBeInTheDocument();
  });

  it('shows empty message when no dailySpend entries exist', () => {
    render(
      <SpendingTrendSection
        dailySpend={[]}
        trend={{ status: 'insufficient_data', observed_days: 0, required_days: 30, message: '' }}
        spikeCallout={null}
      />
    );
    expect(screen.getByTestId('spending-trend-section')).toBeInTheDocument();
    // Empty-state message shown; no wired DailySpendLine figure
    expect(screen.getByTestId('spending-trend-empty')).toBeInTheDocument();
    expect(screen.getByText(/No daily spend data available/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Daily spend over time/i)).not.toBeInTheDocument();
  });

  it('does not render ChatGPT-specific estimate copy', () => {
    const withEstimate: DailySpendEntry[] = [
      { date: '2026-01-01', spend_usd: 5.0, includes_estimated_tier_c: true },
      { date: '2026-01-02', spend_usd: 8.0, includes_estimated_tier_c: true },
    ];
    render(
      <SpendingTrendSection
        dailySpend={withEstimate}
        trend={{ status: 'insufficient_data', observed_days: 30, required_days: 30, message: '' }}
        spikeCallout={null}
      />
    );
    expect(screen.queryByText(/includes ChatGPT Export estimates/i)).toBeNull();
  });

  it('does not append est marker to daily spend values', () => {
    const withEstimate: DailySpendEntry[] = [
      { date: '2026-01-01', spend_usd: 5.0, includes_estimated_tier_c: true },
    ];
    const { container } = render(
      <SpendingTrendSection
        dailySpend={withEstimate}
        trend={{ status: 'insufficient_data', observed_days: 30, required_days: 30, message: '' }}
        spikeCallout={null}
      />
    );
    expect(container.textContent).not.toMatch(/\(est\.\)/);
  });

  it('W6: trend arrow span has aria-hidden="true"', () => {
    const { container } = render(
      <SpendingTrendSection
        dailySpend={dailySpend}
        trend={{ status: 'available', mom_change_pct: 10.0, observed_days: 30, required_days: 30, window_days: 30, message: '' }}
        spikeCallout={null}
      />
    );
    const arrowSpan = container.querySelector('span[aria-hidden="true"]');
    expect(arrowSpan).not.toBeNull();
    expect(arrowSpan!.textContent).toMatch(/▲|▼/);
  });

  it('W6: sr-only span provides "Up" or "Down" text for screen readers', () => {
    render(
      <SpendingTrendSection
        dailySpend={dailySpend}
        trend={{ status: 'available', mom_change_pct: 10.0, observed_days: 30, required_days: 30, window_days: 30, message: '' }}
        spikeCallout={null}
      />
    );
    const srOnly = document.querySelector('.sr-only');
    expect(srOnly).not.toBeNull();
    expect(srOnly!.textContent).toMatch(/Up|Down/);
  });
});
