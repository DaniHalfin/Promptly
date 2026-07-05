/**
 * 3.6 — PrintLayout tests: ADR-9 narrative structure, all recs shown, no interactive elements
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PrintLayout } from '../src/components/export/PrintLayout';
import type { AnalysisReport } from '../src/types/index.js';

const report: AnalysisReport = {
  metadata: {
    generated_at: '2026-06-22T12:00:00.000Z',
    analysis_period_start: '2026-05-23',
    analysis_period_end: '2026-06-22',
    promptly_version: '0.1.0',
    litellm_price_map_date: '2026-06-01',
  },
  sources: [
    {
      source_id: 'openai',
      tier: 'B',
      connected: true,
      error: null,
      metrics: {
        sourceId: 'openai',
        tier: 'B',
        periodStart: '2026-05-23',
        periodEnd: '2026-06-22',
        warnings: [],
        total_actual_spend_usd: 85.25,
        totalActualSpendUsd: 85.25,
        total_actual_tokens: 2530000,
        totalActualTokens: 2530000,
      } as any,
    },
    {
      source_id: 'chatgpt_export',
      tier: 'C',
      connected: true,
      error: null,
      metrics: {
        sourceId: 'chatgpt_export',
        tier: 'C',
        periodStart: '2026-05-23',
        periodEnd: '2026-06-22',
        warnings: [],
        total_conversations: 35,
        total_messages: 175,
        active_days: 14,
        models_identified: ['gpt-4o'],
        estimated_relative_cost_usd: 4.0,
        daily_conversation_activity: [],
        estimated_token_volume: 50000,
      } as any,
    },
  ],
  cross_source_summary: {
    total_actual_spend_usd: 85.25,
    total_estimated_spend_usd: 89.25,
    total_actual_tokens: 2530000,
    total_estimated_tokens: 2530000,
    daily_spend: [
      { date: '2026-06-20', spend_usd: 5.0, includes_estimated_tier_c: false },
      { date: '2026-06-21', spend_usd: 8.0, includes_estimated_tier_c: false },
    ],
    spend_by_tool: [
      { source_id: 'openai', display_name: 'OpenAI', rank: 1, estimated_spend_usd: 85.25, percentage_of_total: 95.5, tier: 'B', is_estimated: false },
      { source_id: 'chatgpt_export', display_name: 'ChatGPT Export', rank: 2, estimated_spend_usd: 4.0, percentage_of_total: 4.5, tier: 'C', is_estimated: true },
    ],
    trend: { status: 'insufficient_data' as const, observed_days: 0, required_days: 30, message: 'Phase 0 stub' },
    spike_callout: null,
    includes_estimates: true,
  },
  recommendations: [
    {
      id: 'R1' as any,
      title: 'Enable prompt caching',
      body: 'Reduce costs by caching repeated system prompts.',
      priority: 'High' as any,
      severity: 'High',
      sourceIds: ['openai' as any],
    },
    {
      id: 'R2' as any,
      title: 'Downgrade model tier',
      body: 'Use a cheaper model for routine tasks.',
      priority: 'Medium' as any,
      severity: 'Medium',
      sourceIds: ['openai' as any],
    },
    {
      id: 'R3' as any,
      title: 'Reduce verbosity',
      body: 'Shorten prompts to save tokens.',
      priority: 'Low' as any,
      severity: 'Low',
      sourceIds: ['openai' as any],
    },
    {
      id: 'R4' as any,
      title: 'Check data freshness',
      body: 'Your most recent data may be stale.',
      priority: 'Medium' as any,
      severity: 'Medium',
      sourceIds: ['chatgpt_export' as any],
    },
  ],
  assumptions: [],
};

describe('PrintLayout — ADR-9 narrative structure', () => {
  it('renders document header with Promptly title', () => {
    render(<PrintLayout report={report} />);
    expect(screen.getByText('Promptly')).toBeInTheDocument();
    expect(screen.getByText('AI Spend Analysis Report')).toBeInTheDocument();
  });

  it('§1 — renders total spend hero figure', () => {
    render(<PrintLayout report={report} />);
    // Total estimated spend is 89.25 (positive), so uses that
    expect(screen.getByText(/89\.25/)).toBeInTheDocument();
    // includes_estimates:true → hero label is "Estimated spend", with no tilde
    expect(screen.getByText(/Estimated spend/i)).toBeInTheDocument();
    expect(screen.queryByText(/~\$89\.25/)).toBeNull();
  });

  it('§2 — renders Spend by Tool section with source bars', () => {
    render(<PrintLayout report={report} />);
    expect(screen.getByText('Spend by Tool')).toBeInTheDocument();
    // "OpenAI" / "ChatGPT Export" appear in §2 bars AND §4 source cards — use getAllByText
    expect(screen.getAllByText('OpenAI').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ChatGPT Export').length).toBeGreaterThanOrEqual(1);
  });

  it('§3 — renders Daily Spend Trend section', () => {
    render(<PrintLayout report={report} />);
    expect(screen.getByText('Daily Spend Trend')).toBeInTheDocument();
    expect(screen.getByText('2026-06-20')).toBeInTheDocument();
    expect(screen.getByText('2026-06-21')).toBeInTheDocument();
  });

  it('§4 — renders AI Sources section with both sources', () => {
    render(<PrintLayout report={report} />);
    expect(screen.getByText('AI Sources')).toBeInTheDocument();
    // Both sources appear (OpenAI and ChatGPT Export)
    expect(screen.getAllByText('OpenAI').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ChatGPT Export').length).toBeGreaterThanOrEqual(1);
  });

  it('prints Estimated spend without tilde or caveat', () => {
    render(<PrintLayout report={report} />);
    // Tier C canonical field renders a plain dollar figure — no ~, no (est.)
    expect(screen.getAllByText(/\$4\.00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/~\$4\.00/)).toBeNull();
    expect(screen.queryByText(/\(est\.\)/)).toBeNull();
    expect(screen.queryByText(/Includes ChatGPT Export estimated/i)).toBeNull();
  });

  it('does not print actual/estimated distinction in source rows', () => {
    render(<PrintLayout report={report} />);
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\(est\.\)/);
    expect(text).not.toMatch(/Est\. Cost/);
    expect(text).not.toMatch(/Incl\. Estimates/);
    expect(text).not.toMatch(/~\$/);
  });

  it('prints Spend when no estimates are included', () => {
    const noEstimates: AnalysisReport = {
      ...report,
      cross_source_summary: { ...report.cross_source_summary, includes_estimates: false },
    };
    render(<PrintLayout report={noEstimates} />);
    // Hero label line: "Spend · N sources · ..." (not "Estimated spend")
    expect(screen.getByText(/^Spend · \d+ source/i)).toBeInTheDocument();
    expect(screen.queryByText(/Estimated spend/i)).toBeNull();
  });

  it('§5 — renders Recommendations section', () => {
    render(<PrintLayout report={report} />);
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
  });

  it('§5 — shows ALL recommendations without a 3-item cap', () => {
    render(<PrintLayout report={report} />);
    // All 4 recs should appear
    expect(screen.getByText('Enable prompt caching')).toBeInTheDocument();
    expect(screen.getByText('Downgrade model tier')).toBeInTheDocument();
    expect(screen.getByText('Reduce verbosity')).toBeInTheDocument();
    expect(screen.getByText('Check data freshness')).toBeInTheDocument();
  });

  it('has NO interactive buttons', () => {
    render(<PrintLayout report={report} />);
    const buttons = document.querySelectorAll('button');
    expect(buttons.length).toBe(0);
  });

  it('has NO input elements (print-safe, no forms)', () => {
    render(<PrintLayout report={report} />);
    const inputs = document.querySelectorAll('input');
    expect(inputs.length).toBe(0);
  });

  it('renders period dates in the header', () => {
    render(<PrintLayout report={report} />);
    // Short-month format: "May 23, 2026" / "Jun 22, 2026" — rely on raw text content
    const text = document.body.textContent ?? '';
    // The dates should appear in some form containing the year and month
    expect(text).toMatch(/May\s+23,\s+2026|2026-05-23/);
    expect(text).toMatch(/Jun\s+22,\s+2026|2026-06-22/);
  });

  it('renders spike callout when present', () => {
    const reportWithSpike: AnalysisReport = {
      ...report,
      cross_source_summary: {
        ...report.cross_source_summary,
        spike_callout: {
          date: '2026-06-21',
          spend_usd: 8.0,
          z_score: 3.1,
          message: 'Unusual spike',
          multiple_of_average: 3.1,
        },
      },
    };
    render(<PrintLayout report={reportWithSpike} />);
    expect(screen.getByText(/Spend spike detected/)).toBeInTheDocument();
    // date appears in both the spike banner and the trend table row — getAllByText
    expect(screen.getAllByText(/2026-06-21/).length).toBeGreaterThanOrEqual(1);
  });
});
