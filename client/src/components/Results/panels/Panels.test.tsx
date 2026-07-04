// @vitest-environment jsdom

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CopilotPanel } from './CopilotPanel';
import { OpenAIPanel } from './OpenAIPanel';
import type { SourceReport } from '../../../types/index';

vi.mock('../charts/DailySpendLine.js', () => ({
  DailySpendLine: () => <div data-testid="daily-spend-line" />,
}));

vi.mock('../charts/ModelCostSharePie.js', () => ({
  ModelCostSharePie: () => <div data-testid="model-cost-share-pie" />,
}));

vi.mock('../charts/TokenRatioBar.js', () => ({
  TokenRatioBar: () => <div data-testid="token-ratio-bar" />,
}));

const copilotReport = (overrides: Partial<SourceReport['metrics']> = {}): SourceReport => ({
  source_id: 'github_copilot',
  tier: 'B',
  connected: true,
  error: null,
  metrics: {
    sourceId: 'github_copilot',
    tier: 'B',
    periodStart: '2026-06-01T00:00:00Z',
    periodEnd: '2026-06-07T00:00:00Z',
    warnings: [],
    totalSpendUsd: 12.34,
    copilotSessionCount: 3,
    copilotTokenBreakdownByModel: [{
      model: 'gpt-5.4',
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 50,
      cacheWriteTokens: 10,
      reasoningTokens: 5,
      requestCount: 2,
      requestCost: 12.34,
    }],
    copilotModelCostBreakdown: [{
      model: 'gpt-5.4',
      costUsd: 12.34,
      costShare: 1,
    }],
    ...overrides,
  },
});

const openAiReport = (overrides: Partial<SourceReport['metrics']> = {}): SourceReport => ({
  source_id: 'openai',
  tier: 'B',
  connected: true,
  error: null,
  metrics: {
    sourceId: 'openai',
    tier: 'B',
    periodStart: '2026-06-01T00:00:00Z',
    periodEnd: '2026-06-07T00:00:00Z',
    warnings: [],
    totalActualSpendUsd: 8,
    modelBreakdown: [{
      model: 'gpt-4o',
      estimatedCostShare: 1,
      estimatedCostUsd: 8,
      inputTokens: 100,
      outputTokens: 50,
      inputOutputRatio: 2,
      estimated: true,
    }],
    ...overrides,
  },
});

describe('result panels', () => {
  it('renders Copilot avg tokens per session with a formatted number', () => {
    render(<CopilotPanel report={copilotReport({ copilotAvgTokensPerSession: 12345.6 })} />);

    expect(screen.getAllByText('Avg tokens/session').length).toBeGreaterThan(0);
    expect(screen.getByTestId('copilot-avg-tokens-per-session').textContent).toBe('12,346');
  });

  it('renders — when Copilot avg tokens per session is undefined', () => {
    render(<CopilotPanel report={copilotReport({ copilotAvgTokensPerSession: undefined })} />);

    expect(screen.getAllByText('Avg tokens/session').length).toBeGreaterThan(0);
    expect(screen.getByTestId('copilot-avg-tokens-per-session').textContent).toBe('—');
  });

  it('renders — for source totalSpendUsd when undefined', () => {
    render(<OpenAIPanel report={openAiReport({ totalSpendUsd: undefined })} />);

    expect(screen.getAllByText('Total Spend').length).toBeGreaterThan(0);
    expect(screen.getByTestId('openai-total-spend').textContent).toBe('—');
  });

  it('renders the Copilot estimated spend tooltip/icon with the spend chart', () => {
    render(<CopilotPanel report={copilotReport({
      dailySpend: [
        { date: '2026-06-01', spendUsd: 2.5 },
        { date: '2026-06-02', spendUsd: 3.5 },
      ],
      copilotAvgTokensPerSession: 1000,
    })} />);

    expect(screen.getByTestId('copilot-estimated-spend-info').getAttribute('title'))
      .toBe('Estimated from token usage and LiteLLM price map');
    expect(screen.getByTestId('daily-spend-line')).toBeTruthy();
  });
});
