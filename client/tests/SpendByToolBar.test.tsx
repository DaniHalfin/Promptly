/**
 * 3.4 — SpendByToolBar component tests
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SpendByToolBar } from '../src/components/Results/SpendByToolBar';
import type { SpendByToolEntry } from '../src/types/index.js';

const entries: SpendByToolEntry[] = [
  { source_id: 'openai', display_name: 'OpenAI', rank: 1, estimated_spend_usd: 80, percentage_of_total: 57.1, tier: 'B', is_estimated: false },
  { source_id: 'anthropic', display_name: 'Anthropic', rank: 2, estimated_spend_usd: 40, percentage_of_total: 28.6, tier: 'B', is_estimated: false },
  { source_id: 'chatgpt_export', display_name: 'ChatGPT Export', rank: 3, estimated_spend_usd: 20, percentage_of_total: 14.3, tier: 'C', is_estimated: true, estimate_label: '~' },
];

describe('SpendByToolBar', () => {
  it('renders one bar per source', () => {
    render(<SpendByToolBar data={entries} />);
    expect(screen.getByTestId('spend-bar-openai')).toBeInTheDocument();
    expect(screen.getByTestId('spend-bar-anthropic')).toBeInTheDocument();
    expect(screen.getByTestId('spend-bar-chatgpt_export')).toBeInTheDocument();
  });

  it('renders spend amounts', () => {
    render(<SpendByToolBar data={entries} />);
    // amounts appear in visible bar + sr-only table, so getAllByText
    expect(screen.getAllByText(/\$80\.00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/\$40\.00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/\$20\.00/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders fill elements for each source', () => {
    render(<SpendByToolBar data={entries} />);
    expect(screen.getByTestId('spend-bar-fill-openai')).toBeInTheDocument();
    expect(screen.getByTestId('spend-bar-fill-anthropic')).toBeInTheDocument();
    expect(screen.getByTestId('spend-bar-fill-chatgpt_export')).toBeInTheDocument();
  });

  it('highest-spend bar fill has 100% width', () => {
    render(<SpendByToolBar data={entries} />);
    const topFill = screen.getByTestId('spend-bar-fill-openai');
    expect(topFill.style.width).toBe('100%');
  });

  it('second-highest-spend bar fill has proportional width (50% of max)', () => {
    render(<SpendByToolBar data={entries} />);
    const fill = screen.getByTestId('spend-bar-fill-anthropic');
    expect(fill.style.width).toBe('50%');
  });

  it('renders ~ prefix for estimated entries', () => {
    render(<SpendByToolBar data={entries} />);
    // chatgpt_export is estimated — its amount should show ~ prefix
    expect(screen.getByText(/~\$20\.00/)).toBeInTheDocument();
  });

  it('renders empty state message when no entries', () => {
    render(<SpendByToolBar data={[]} />);
    expect(screen.getByText(/No spend data available/)).toBeInTheDocument();
  });
});
