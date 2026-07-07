/**
 * 3.4 — AnalysisHeader component tests
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AnalysisHeader } from '../src/components/Results/AnalysisHeader';

const baseProps = {
  totalSpend: 99.42,
  spendLabel: 'Spend' as const,
  dateRange: { start: '2026-01-01', end: '2026-01-31' },
  sourceCount: 2,
};

describe('AnalysisHeader', () => {
  it('renders total spend hero figure', () => {
    render(<AnalysisHeader {...baseProps} />);
    expect(screen.getByText(/99\.42/)).toBeInTheDocument();
  });

  it('renders source count and date range', () => {
    render(<AnalysisHeader {...baseProps} />);
    expect(screen.getByText(/2 sources/)).toBeInTheDocument();
    expect(screen.getByText(/2026-01-01/)).toBeInTheDocument();
    expect(screen.getByText(/2026-01-31/)).toBeInTheDocument();
  });

  it('shows "Save up to $X across Y recommendations" when savings > 0', () => {
    render(<AnalysisHeader {...baseProps} totalPotentialSavingsUsd={42.5} actionableRecommendationCount={3} />);
    expect(screen.getByTestId('potential-savings-callout')).toBeInTheDocument();
    expect(screen.getByText('Total potential savings')).toBeInTheDocument();
    expect(screen.getByText(/Save up to/)).toBeInTheDocument();
    expect(screen.getByText('$42.50')).toBeInTheDocument();
    expect(screen.getByText(/across 3 recommendations/)).toBeInTheDocument();
    // FIX-6: narrow "savings estimated" sub-note was removed from the callout
    expect(screen.queryByText(/Savings estimates are based on your usage patterns/)).not.toBeInTheDocument();
  });

  it('suppresses savings callout when no topSlotEligible recs', () => {
    render(<AnalysisHeader {...baseProps} totalPotentialSavingsUsd={0} actionableRecommendationCount={0} />);
    expect(screen.queryByTestId('potential-savings-callout')).not.toBeInTheDocument();
  });

  it('renders Estimated spend without a tilde', () => {
    render(<AnalysisHeader {...baseProps} spendLabel="Estimated spend" />);
    // Label reads "Estimated spend"
    expect(screen.getByText(/Estimated spend/i)).toBeInTheDocument();
    // Hero figure has NO ~ prefix
    expect(screen.getByText(/\$99\.42/)).toBeInTheDocument();
    expect(screen.queryByText(/~\$99\.42/)).not.toBeInTheDocument();
  });

  it('renders Spend when no estimates are included', () => {
    render(<AnalysisHeader {...baseProps} spendLabel="Spend" />);
    // Use getAllByText and verify at least one element contains just the label
    const matches = screen.getAllByText(/\bSpend\b/);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Estimated spend/i)).not.toBeInTheDocument();
  });

  it('does not render ChatGPT Export estimate note', () => {
    render(<AnalysisHeader {...baseProps} spendLabel="Estimated spend" />);
    expect(screen.queryByText(/Includes ChatGPT Export estimated/i)).not.toBeInTheDocument();
  });

  it('renders singular "source" when sourceCount is 1', () => {
    render(<AnalysisHeader {...baseProps} sourceCount={1} />);
    expect(screen.getByText(/1 source\b/)).toBeInTheDocument();
  });

  it('spend-estimate disclosure has role="note" and is always visible — FIX-6', () => {
    render(
      <AnalysisHeader
        {...baseProps}
        totalPotentialSavingsUsd={30}
        actionableRecommendationCount={2}
      />
    );
    const note = document.querySelector('[role="note"]');
    expect(note).not.toBeNull();
    expect(note?.textContent).toMatch(/All spend figures are estimates/i);
  });

  it('spend-estimate disclosure is visible even without savings callout — FIX-6', () => {
    render(<AnalysisHeader {...baseProps} totalPotentialSavingsUsd={0} actionableRecommendationCount={0} />);
    const note = document.querySelector('[role="note"]');
    expect(note).not.toBeNull();
    expect(note?.textContent).toMatch(/All spend figures are estimates/i);
  });

  it('savings callout and spend-estimate disclosure coexist in the same render — RT-5', () => {
    // RT-5: the two FIX-6 duplicate tests had identical bodies. This replacement
    // verifies that both the savings callout AND the disclosure note are rendered
    // together when savings are non-zero.
    render(<AnalysisHeader {...baseProps} totalPotentialSavingsUsd={5.00} actionableRecommendationCount={2} />);

    // Savings callout must appear (non-zero totalPotentialSavingsUsd)
    const callout = screen.getByTestId('potential-savings-callout');
    expect(callout).toBeInTheDocument();
    expect(callout.textContent).toMatch(/\$5\.00/);

    // Disclosure note must still appear alongside the callout
    const note = document.querySelector('[role="note"]');
    expect(note).not.toBeNull();
    expect(note?.textContent).toMatch(/All spend figures are estimates/i);
  });
});

describe('FIX-6: spend-estimate disclosure', () => {
  it('renders the global spend-estimate disclosure note regardless of savings data', () => {
    render(
      <AnalysisHeader
        totalSpend={42.50}
        spendLabel="Estimated spend"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        sourceCount={2}
        totalPotentialSavingsUsd={0}
        actionableRecommendationCount={0}
      />
    );
    const note = screen.getByTestId('spend-estimate-disclosure');
    expect(note).toBeInTheDocument();
    expect(note).toHaveTextContent(/all spend figures are estimates/i);
  });

  it('does not contain a "savings estimates" narrow disclaimer within the savings callout', () => {
    const { container } = render(
      <AnalysisHeader
        totalSpend={42.50}
        spendLabel="Estimated spend"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        sourceCount={2}
        totalPotentialSavingsUsd={10}
        actionableRecommendationCount={1}
      />
    );
    const callout = container.querySelector('[data-testid="potential-savings-callout"]');
    expect(callout?.textContent).not.toMatch(/savings estimates are based on your usage patterns/i);
  });
});
