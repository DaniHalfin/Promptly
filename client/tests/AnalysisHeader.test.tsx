/**
 * 3.4 — AnalysisHeader component tests
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AnalysisHeader } from '../src/components/Results/AnalysisHeader';

const baseProps = {
  totalSpend: 99.42,
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

  it('renders estimated label when isEstimated=true', () => {
    render(<AnalysisHeader {...baseProps} isEstimated />);
    // "Estimated" appears in the hero label — getAllByText since disclaimer also mentions it
    expect(screen.getAllByText(/Estimated/i).length).toBeGreaterThanOrEqual(1);
    // Hero figure has ~ prefix — check for ~$ in the overall text
    expect(screen.getByText(/~\$99\.42/)).toBeInTheDocument();
  });

  it('renders singular "source" when sourceCount is 1', () => {
    render(<AnalysisHeader {...baseProps} sourceCount={1} />);
    expect(screen.getByText(/1 source\b/)).toBeInTheDocument();
  });
});
