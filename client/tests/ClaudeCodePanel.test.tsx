import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClaudeCodePanel } from '../src/components/Results/panels/ClaudeCodePanel';
import type { SourceMetrics, SourceReport } from '../src/types/index.js';

vi.mock('../components/Results/charts/DailySpendLine.js', () => ({
  DailySpendLine: () => <div data-testid="daily-spend-line" />,
}));
vi.mock('../components/Results/charts/ModelCostSharePie.js', () => ({
  ModelCostSharePie: () => <div data-testid="model-cost-share-pie" />,
}));

const baseMetrics: SourceMetrics = {
  sourceId: 'claude_code',
  tier: 'B',
  periodStart: '2026-05-01',
  periodEnd: '2026-05-31',
  warnings: [],
  totalActualSpendUsd: 42.5,
  claudeCodeSessionCount: 37,
  claudeCodeAvgTokensPerSession: 12500,
  claudeCodePeakHourFraction: 0.32,
  cachedTokenFractionClaudeCode: 0.28,
  cachedTokenSavingsUsdClaudeCode: 8.75,
};

function report(metrics: SourceMetrics = baseMetrics): SourceReport {
  return {
    source_id: 'claude_code',
    tier: 'B',
    connected: true,
    error: null,
    metrics,
  };
}

describe('ClaudeCodePanel', () => {
  it('renders session count and average tokens KPIs', () => {
    render(<ClaudeCodePanel report={report()} />);

    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('37')).toBeInTheDocument();
    expect(screen.getByText('Avg tokens per session')).toBeInTheDocument();
    expect(screen.getByText('13k tokens')).toBeInTheDocument();
  });

  it('renders peak hour metric when claudeCodePeakHourFraction is defined', () => {
    render(<ClaudeCodePanel report={report()} />);

    expect(screen.getByText('Peak hour sessions')).toBeInTheDocument();
    expect(screen.getByText('32.0%')).toBeInTheDocument();
  });

  it('does not render peak hour metric when claudeCodePeakHourFraction is undefined', () => {
    const { claudeCodePeakHourFraction, ...metrics } = baseMetrics;
    render(<ClaudeCodePanel report={report(metrics)} />);

    expect(screen.queryByText('Peak hour sessions')).not.toBeInTheDocument();
  });

  it('renders cache callout when cachedTokenFractionClaudeCode is defined', () => {
    render(<ClaudeCodePanel report={report()} />);

    expect(screen.getByText('Prompt cache impact')).toBeInTheDocument();
    expect(screen.getByText(/28.0% of input tokens were served from cache/i)).toBeInTheDocument();
    expect(screen.getByText(/\$8.75/i)).toBeInTheDocument();
  });

  it('does not render cache callout when cachedTokenFractionClaudeCode is undefined', () => {
    const { cachedTokenFractionClaudeCode, ...metrics } = baseMetrics;
    render(<ClaudeCodePanel report={report(metrics)} />);

    expect(screen.queryByText('Prompt cache impact')).not.toBeInTheDocument();
  });

  it('shows tier badge for non-local source (ClaudeCode always shows tier)', () => {
    render(<ClaudeCodePanel report={report()} />);

    // ClaudeCode uses tier badge (not Connected pill) — tier B shown
    expect(screen.getByText(/tier b/i)).toBeInTheDocument();
  });
});



