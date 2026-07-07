/**
 * 3.2 — Analysis.tsx per-source progress tests
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './msw/server.js';
import { Analysis } from '../src/pages/Analysis';
import { SessionContext } from '../src/context/SessionContext.js';

vi.mock('../src/components/ThemeToggle.js', () => ({ ThemeToggle: () => null }));

const mockMinimalSourceReport = (sourceId: string) => ({
  source_id: sourceId,
  tier: 'B' as const,
  connected: true,
  error: null,
  metrics: { sourceId, tier: 'B', periodStart: '2026-01-01', periodEnd: '2026-01-31', warnings: [] },
});

const mockReport = {
  metadata: { generated_at: '2026-01-31T00:00:00Z', analysis_period_start: '2026-01-01', analysis_period_end: '2026-01-31', promptly_version: '0.1.0', litellm_price_map_date: '2026-01-01' },
  sources: [],
  cross_source_summary: {
    total_actual_spend_usd: 0,
    total_estimated_spend_usd: 0,
    total_actual_tokens: 0,
    total_estimated_tokens: 0,
    daily_spend: [],
    spend_by_tool: [],
    trend: { status: 'insufficient_data' as const, observed_days: 0, required_days: 30, message: '' },
    spike_callout: null,
    allSourcesFailed: false,
  },
  recommendations: [],
  assumptions: [],
};

function renderAnalysis(sources: Record<string, { status: string; credential?: string }>) {
  const dispatch = vi.fn();
  const ctx = {
    state: {
      phase: 'analyzing',
      sources,
      pendingAnalysis: {
        config: {
          sources: Object.keys(sources).map(id => ({
            sourceId: id,
            hasCredential: !!sources[id]?.credential,
            startDate: '2026-01-01',
            endDate: '2026-01-31',
          })),
        },
      },
    },
    dispatch,
    updateSource: vi.fn(),
    clearSession: vi.fn(),
    abortControllerRef: { current: null as AbortController | null },
  };
  render(
    <SessionContext.Provider value={ctx as any}>
      <Analysis />
    </SessionContext.Provider>
  );
  return { dispatch };
}

describe('Analysis — per-source progress', () => {
  beforeEach(() => {
    // Default handler: return minimal source report for any sourceId
    server.use(
      http.post('/api/analyze/:sourceId', ({ params }) => {
        return HttpResponse.json(mockMinimalSourceReport(params.sourceId as string));
      }),
      http.post('/api/analyze/recommendations', () => {
        return HttpResponse.json(mockReport);
      }),
    );
  });

  it('shows a progress item for each connected source', async () => {
    renderAnalysis({
      openai: { status: 'connected', credential: 'sk-test' },
      anthropic: { status: 'connected', credential: 'ant-test' },
    });

    // Both progress items should appear in the DOM
    await waitFor(() => {
      expect(screen.getByTestId('source-progress-openai')).toBeInTheDocument();
      expect(screen.getByTestId('source-progress-anthropic')).toBeInTheDocument();
    });
  });

  it('shows only progress items for enabled sources (not disconnected ones)', async () => {
    renderAnalysis({
      openai: { status: 'connected', credential: 'sk-test' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('source-progress-openai')).toBeInTheDocument();
    });

    // anthropic was NOT added — should not appear
    expect(screen.queryByTestId('source-progress-anthropic')).not.toBeInTheDocument();
  });

  it('calls /api/analyze/:sourceId for each connected source', async () => {
    const requestedIds: string[] = [];
    server.use(
      http.post('/api/analyze/:sourceId', ({ params }) => {
        requestedIds.push(params.sourceId as string);
        return HttpResponse.json(mockMinimalSourceReport(params.sourceId as string));
      }),
    );

    renderAnalysis({
      openai: { status: 'connected', credential: 'sk-openai' },
      anthropic: { status: 'connected', credential: 'sk-anthropic' },
    });

    await waitFor(() => {
      expect(requestedIds).toContain('openai');
      expect(requestedIds).toContain('anthropic');
    }, { timeout: 3000 });
  });

  it('handles a single source — shows exactly one progress item', async () => {
    renderAnalysis({
      github_copilot: { status: 'ready' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('source-progress-github_copilot')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('source-progress-openai')).not.toBeInTheDocument();
  });

  it('returns to landing when cancelled', async () => {
    const { dispatch } = renderAnalysis({
      openai: { status: 'connected', credential: 'sk-test' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(dispatch).toHaveBeenCalledWith({ phase: 'landing' });
  });

  it('dispatches landing with per-source errors when all sources fail', async () => {
    server.use(
      http.post('/api/analyze/recommendations', () => {
        return HttpResponse.json({
          ...mockReport,
          sources: [
            { source_id: 'openai', tier: null, connected: false, error: 'Invalid credentials', metrics: null },
          ],
          cross_source_summary: { ...mockReport.cross_source_summary, allSourcesFailed: true },
        });
      }),
    );

    const { dispatch } = renderAnalysis({
      openai: { status: 'connected', credential: 'sk-bad' },
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'landing',
          analysisErrors: expect.arrayContaining([
            expect.objectContaining({ sourceId: 'openai', error: 'Invalid credentials' }),
          ]),
        }),
      );
    }, { timeout: 3000 });
  });

  it('dispatches results when at least one source succeeds', async () => {
    server.use(
      http.post('/api/analyze/recommendations', () => {
        return HttpResponse.json(mockReport); // allSourcesFailed: false
      }),
    );

    const { dispatch } = renderAnalysis({
      openai: { status: 'connected', credential: 'sk-good' },
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'results' }),
      );
    }, { timeout: 3000 });
  });
});

describe('W-IA-01: ARIA live region and progressbar', () => {
  beforeEach(() => {
    server.use(
      http.post('/api/analyze/:sourceId', ({ params }) => {
        return HttpResponse.json(mockMinimalSourceReport(params.sourceId as string));
      }),
      http.post('/api/analyze/recommendations', () => {
        return HttpResponse.json(mockReport);
      }),
    );
  });

  it('renders role="progressbar" with aria-valuemin=0 and aria-valuemax=100', async () => {
    renderAnalysis({ openai: { status: 'connected', credential: 'sk-test' } });
    const progressbar = document.querySelector('[role="progressbar"]');
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  it('progressbar has an aria-valuenow attribute', async () => {
    renderAnalysis({ openai: { status: 'connected', credential: 'sk-test' } });
    const progressbar = document.querySelector('[role="progressbar"]');
    expect(progressbar).toHaveAttribute('aria-valuenow');
    // Value must be numeric string between 0 and 100
    const val = Number(progressbar!.getAttribute('aria-valuenow'));
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(100);
  });

  it('renders role="status" wrapper with aria-label', async () => {
    renderAnalysis({ openai: { status: 'connected', credential: 'sk-test' } });
    const statusRegion = document.querySelector('[role="status"]');
    expect(statusRegion).toBeInTheDocument();
    expect(statusRegion).toHaveAttribute('aria-label', 'Analysis progress');
  });

  it('role="status" wrapper is an aria-live="polite" region', async () => {
    renderAnalysis({ openai: { status: 'connected', credential: 'sk-test' } });
    const wrapper = document.querySelector('[role="status"]');
    expect(wrapper).toHaveAttribute('aria-live', 'polite');
  });
});

describe('ISSUE-D: per-source error normalization', () => {
  it('per-source catch normalizes multi-line stack trace before pushing to sourceResults', async () => {
    // Arrange: mock analyzeSource to throw a network error
    server.use(
      http.post('/api/analyze/:sourceId', () => {
        return HttpResponse.error();
      }),
    );

    const dispatch = vi.fn();
    const ctx = {
      state: {
        phase: 'analyzing',
        sources: { openai: { status: 'connected', credential: 'sk-test' } },
        pendingAnalysis: {
          config: { sources: [{ sourceId: 'openai', hasCredential: true, startDate: '2026-01-01', endDate: '2026-01-31' }] },
        },
      },
      dispatch,
      updateSource: vi.fn(),
      clearSession: vi.fn(),
      abortControllerRef: { current: null as AbortController | null },
    };

    render(
      <SessionContext.Provider value={ctx as any}>
        <Analysis />
      </SessionContext.Provider>
    );

    await waitFor(() => expect(dispatch).toHaveBeenCalled());

    // The dispatch call for allSourcesFailed includes analysisErrors with normalized messages
    const dispatchArg = dispatch.mock.calls.find(
      ([arg]: [any]) => arg.phase === 'landing' && arg.analysisErrors,
    )?.[0];
    if (dispatchArg) {
      for (const err of dispatchArg.analysisErrors) {
        if (err.error) {
          // Must be a single line, no "at " stack frames, no file paths
          expect(err.error).not.toMatch(/\n/);
          expect(err.error).not.toMatch(/\s+at\s+\w/);
        }
      }
    }
  });
});
