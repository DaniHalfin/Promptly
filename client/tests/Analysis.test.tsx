/**
 * 3.2 — Analysis.tsx per-source progress tests
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
});
