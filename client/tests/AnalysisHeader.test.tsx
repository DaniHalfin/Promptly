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

  it('renders top recommendation callout when topRecommendation is provided', () => {
    render(
      <AnalysisHeader
        {...baseProps}
        topRecommendation={{ id: 'R1', title: 'Enable prompt caching', priority: 'High' }}
      />
    );
    expect(screen.getByTestId('top-recommendation-callout')).toBeInTheDocument();
    expect(screen.getByText('Enable prompt caching')).toBeInTheDocument();
    expect(screen.getByText('Top recommendation')).toBeInTheDocument();
  });

  it('does NOT render top recommendation callout when topRecommendation is absent', () => {
    render(<AnalysisHeader {...baseProps} />);
    expect(screen.queryByTestId('top-recommendation-callout')).not.toBeInTheDocument();
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
    expect(screen.getByText(/\bSpend\b/i)).toBeInTheDocument();
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
});
