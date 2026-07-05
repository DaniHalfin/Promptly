/**
 * 3.3 — Results page tests: ADR-9 narrative layout
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Results } from '../src/pages/Results';
import { useSession } from '../src/context/SessionContext.js';

// Mock all sub-components and dependencies
vi.mock('../src/components/export/PrintLayout.js',           () => ({ PrintLayout: () => null }));
vi.mock('../src/components/ThemeToggle.js',                  () => ({ ThemeToggle: () => null }));
vi.mock('../src/components/Results/AnalysisHeader.js',       () => ({ AnalysisHeader: () => <div data-testid="analysis-header" /> }));
vi.mock('../src/components/Results/MoneyByToolSection.js',   () => ({ MoneyByToolSection: () => <div data-testid="money-by-tool-section" /> }));
vi.mock('../src/components/Results/SpendingTrendSection.js', () => ({ SpendingTrendSection: () => <div data-testid="spending-trend-section" /> }));
vi.mock('../src/components/Results/ToolSpendCard.js', () => ({
  ToolSpendCard: ({ source }: { source: { source_id: string } }) => (
    <div data-testid={`tool-spend-card-${source.source_id}`} />
  ),
}));
vi.mock('html2canvas',  () => ({ default: vi.fn() }));
vi.mock('jspdf',        () => ({ default: vi.fn(function (this: any) { return { internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } }, addImage: vi.fn(), addPage: vi.fn(), save: vi.fn() }; }) }));
vi.mock('react-dom/client', () => ({ default: { createRoot: vi.fn(() => ({ render: vi.fn(), unmount: vi.fn() })) } }));

const mockReport = {
  metadata: { generated_at: '2026-06-01T00:00:00Z', analysis_period_start: '2026-01-01', analysis_period_end: '2026-01-31', promptly_version: '0.1.0', litellm_price_map_date: '2026-01-01' },
  sources: [
    { source_id: 'openai', tier: 'B', connected: true, error: null, metrics: { total_actual_spend_usd: 80 } },
    { source_id: 'anthropic', tier: 'B', connected: true, error: null, metrics: { total_actual_spend_usd: 40 } },
  ],
  cross_source_summary: {
    total_actual_spend_usd: 120,
    total_estimated_spend_usd: 120,
    total_actual_tokens: 0,
    total_estimated_tokens: 0,
    daily_spend: [],
    spend_by_tool: [
      { source_id: 'openai', display_name: 'OpenAI', rank: 1, estimated_spend_usd: 80, percentage_of_total: 66.7, tier: 'B', is_estimated: false },
      { source_id: 'anthropic', display_name: 'Anthropic', rank: 2, estimated_spend_usd: 40, percentage_of_total: 33.3, tier: 'B', is_estimated: false },
    ],
    trend: { status: 'insufficient_data' as const, observed_days: 0, required_days: 30, message: '' },
    spike_callout: null,
    allSourcesFailed: false,
  },
  recommendations: [],
  assumptions: [],
};

vi.mock('../src/context/SessionContext.js', () => ({
  useSession: vi.fn(() => ({
    state: { report: mockReport },
    dispatch: vi.fn(),
  })),
}));

describe('Results — ADR-9 narrative layout', () => {
  it('renders AnalysisHeader', () => {
    render(<Results />);
    expect(screen.getByTestId('analysis-header')).toBeInTheDocument();
  });

  it('renders MoneyByToolSection', () => {
    render(<Results />);
    expect(screen.getByTestId('money-by-tool-section')).toBeInTheDocument();
  });

  it('renders SpendingTrendSection', () => {
    render(<Results />);
    expect(screen.getByTestId('spending-trend-section')).toBeInTheDocument();
  });

  it('renders one ToolSpendCard per source', () => {
    render(<Results />);
    expect(screen.getByTestId('tool-spend-card-openai')).toBeInTheDocument();
    expect(screen.getByTestId('tool-spend-card-anthropic')).toBeInTheDocument();
  });

  it('has NO tab elements in the DOM', () => {
    render(<Results />);
    expect(document.querySelectorAll('[role="tab"]').length).toBe(0);
    expect(document.querySelectorAll('[role="tablist"]').length).toBe(0);
  });

  it('renders Export PDF button', () => {
    render(<Results />);
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeInTheDocument();
  });

  it('renders Export JSON button', () => {
    render(<Results />);
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeInTheDocument();
  });

  it('renders Budget CTA section', () => {
    render(<Results />);
    expect(screen.getByText('Set a Budget')).toBeInTheDocument();
  });

  it('returns null when report is missing', () => {
    vi.mocked(useSession).mockReturnValueOnce({
      state: { report: null as any, sources: {} },
      dispatch: vi.fn(),
      updateSource: vi.fn(),
      clearSession: vi.fn(),
      abortControllerRef: { current: null },
    });
    const { container } = render(<Results />);
    expect(container.firstChild).toBeNull();
  });
});
