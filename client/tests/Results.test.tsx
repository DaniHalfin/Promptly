/**
 * 3.3 — Results page tests: ADR-9 narrative layout
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Results } from '../src/pages/Results';
import { useSession } from '../src/context/SessionContext.js';

// Mock all sub-components and dependencies
vi.mock('../src/components/export/PrintLayout.js',           () => ({ PrintLayout: () => null }));
vi.mock('../src/components/ThemeToggle.js',                  () => ({ ThemeToggle: () => null }));
vi.mock('../src/components/Results/AnalysisHeader.js', () => ({
  AnalysisHeader: (props: { spendLabel?: string; totalPotentialSavingsUsd?: number; actionableRecommendationCount?: number }) => (
    <div
      data-testid="analysis-header"
      data-spend-label={props.spendLabel}
      data-total-potential-savings={props.totalPotentialSavingsUsd}
      data-actionable-count={props.actionableRecommendationCount}
    />
  ),
}));
vi.mock('../src/components/Results/MoneyByToolSection.js',   () => ({
  MoneyByToolSection: (props: any) => (
    <div data-testid="money-by-tool-section" data-top-count={props.topRecommendations?.length ?? 0}>
      {(props.topRecommendations ?? []).map((rec: any) => (
        <button key={`${rec.id}-${rec.source_id}`} data-testid={`mock-top-${rec.id}-${rec.source_id}`} onClick={() => props.onTopRecommendationClick(rec)}>
          {rec.compact_headline}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('../src/components/Results/SpendingTrendSection.js', () => ({ SpendingTrendSection: () => <div data-testid="spending-trend-section" /> }));
vi.mock('../src/components/Results/ToolSpendCard.js', () => ({
  ToolSpendCard: ({ source, recommendations, expanded }: { source: { source_id: string }; recommendations: Array<{ id: string }>; expanded: boolean }) => (
    <div id={`tool-card-${source.source_id}`} tabIndex={-1} data-testid={`tool-spend-card-${source.source_id}`} data-expanded={String(expanded)}>
      {expanded && recommendations.map(rec => <div key={rec.id} id={`rec-${source.source_id}-${rec.id}`} tabIndex={-1} data-testid={`mock-rec-${source.source_id}-${rec.id}`} />)}
    </div>
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

  it('W14: does not render the dead-end "Set a Budget" placeholder', () => {
    render(<Results />);
    expect(screen.queryByText(/Set a Budget/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Budget tracking coming soon/i)).not.toBeInTheDocument();
  });

  it('W13: h1 "Analysis Results" is visible — not visually hidden', () => {
    render(<Results />);
    const h1 = screen.getByRole('heading', { level: 1, name: /Analysis Results/i });
    expect(h1).toBeInTheDocument();
    // Must NOT carry sr-only or visually-hidden positioning
    expect(h1.style.position).not.toBe('absolute');
    expect(h1.style.width).not.toBe('1px');
    expect(h1.style.clip).not.toMatch(/rect\(0/);
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

  it('passes Spend label when summary does not include estimates', () => {
    // Default mockReport has no includes_estimates flag → 'Spend'
    render(<Results />);
    expect(screen.getByTestId('analysis-header')).toHaveAttribute('data-spend-label', 'Spend');
  });

  it('passes Estimated spend label when summary includes estimates', () => {
    const estimatedReport = {
      ...mockReport,
      cross_source_summary: { ...mockReport.cross_source_summary, includes_estimates: true },
    };
    vi.mocked(useSession).mockReturnValueOnce({
      state: { report: estimatedReport as any },
      dispatch: vi.fn(),
      updateSource: vi.fn(),
      clearSession: vi.fn(),
      abortControllerRef: { current: null },
    } as any);
    render(<Results />);
    expect(screen.getByTestId('analysis-header')).toHaveAttribute('data-spend-label', 'Estimated spend');
  });

  it('returns to landing when Back is clicked', () => {
    const dispatch = vi.fn();
    vi.mocked(useSession).mockReturnValueOnce({
      state: { report: mockReport as any },
      dispatch,
      updateSource: vi.fn(),
      clearSession: vi.fn(),
      abortControllerRef: { current: null },
    } as any);
    render(<Results />);
    const back = screen.getByRole('button', { name: /Back/i });
    // A2: Back button meets the 44px touch target minimum
    expect(back).toHaveStyle({ minHeight: '44px' });
    fireEvent.click(back);
    expect(dispatch).toHaveBeenCalledWith({ phase: 'landing' });
  });

  describe('Results top recommendations', () => {
    const topRecommendation = {
      id: 'R1',
      title: 'Anthropic prompt caching opportunity',
      compact_headline: 'Enable prompt caching',
      source_id: 'anthropic',
      target_card_anchor: '#tool-card-anthropic',
      target_recommendation_anchor: '#rec-anthropic-R1',
      estimated_savings_usd: 12.34,
      savings_label: 'Save $12.34',
      severity: 'Medium',
    };

    const reportWithTop = {
      ...mockReport,
      cross_source_summary: {
        ...mockReport.cross_source_summary,
        top_recommendations: [topRecommendation],
      },
      recommendations: [
        {
          id: 'R1',
          severity: 'Medium',
          title: 'Anthropic prompt caching opportunity',
          body: 'Enable cache writes.',
          triggeringMetric: 'cacheCreationInputTokensAnthropic',
          triggeringValue: 0,
          sourceIds: ['anthropic'],
        },
      ],
    };

    it('passes top recommendations to MoneyByToolSection', () => {
      vi.mocked(useSession).mockReturnValueOnce({
        state: { report: reportWithTop as any },
        dispatch: vi.fn(),
        updateSource: vi.fn(),
        clearSession: vi.fn(),
        abortControllerRef: { current: null },
      } as any);

      render(<Results />);
      expect(screen.getByTestId('money-by-tool-section')).toHaveAttribute('data-top-count', '1');
    });

    it('expands and scrolls to the target recommendation anchor when a top recommendation is activated', async () => {
      const scrollIntoView = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoView;
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
        setTimeout(() => cb(0), 0);
        return 1;
      });
      vi.mocked(useSession).mockReturnValueOnce({
        state: { report: reportWithTop as any },
        dispatch: vi.fn(),
        updateSource: vi.fn(),
        clearSession: vi.fn(),
        abortControllerRef: { current: null },
      } as any);

      render(<Results />);
      expect(screen.getByTestId('tool-spend-card-anthropic')).toHaveAttribute('data-expanded', 'false');
      fireEvent.click(screen.getByTestId('mock-top-R1-anthropic'));

      await waitFor(() => expect(screen.getByTestId('tool-spend-card-anthropic')).toHaveAttribute('data-expanded', 'true'));
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    });

    it('falls back to target_card_anchor when target_recommendation_anchor is missing', async () => {
      const scrollIntoView = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoView;
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
        setTimeout(() => cb(0), 0);
        return 1;
      });
      const fallbackReport = {
        ...reportWithTop,
        cross_source_summary: {
          ...reportWithTop.cross_source_summary,
          top_recommendations: [{ ...topRecommendation, target_recommendation_anchor: undefined }],
        },
      };
      vi.mocked(useSession).mockReturnValueOnce({
        state: { report: fallbackReport as any },
        dispatch: vi.fn(),
        updateSource: vi.fn(),
        clearSession: vi.fn(),
        abortControllerRef: { current: null },
      } as any);

      render(<Results />);
      fireEvent.click(screen.getByTestId('mock-top-R1-anthropic'));

      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
      expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById('tool-card-anthropic'));
    });
  });
});
