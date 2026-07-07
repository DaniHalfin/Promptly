/**
 * 3.4 — DailyConversationActivityLine component tests
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DailyConversationActivityLine } from '../src/components/Results/DailyConversationActivityLine';
import type { DailyConversationActivityEntry } from '../src/types/index.js';

// Mock Recharts to avoid canvas/layout issues in jsdom
vi.mock('recharts', () => ({
  LineChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="recharts-line-chart" data-points={data.length}>{children}</div>
  ),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const makeData = (n: number): DailyConversationActivityEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    conversation_count: i + 1,
  }));

describe('DailyConversationActivityLine', () => {
  it('renders correct number of data points (7)', () => {
    const data = makeData(7);
    render(<DailyConversationActivityLine data={data} />);
    const chart = screen.getByTestId('recharts-line-chart');
    expect(chart).toHaveAttribute('data-points', '7');
  });

  it('renders correct number of data points (30)', () => {
    const data = makeData(30);
    render(<DailyConversationActivityLine data={data} />);
    const chart = screen.getByTestId('recharts-line-chart');
    expect(chart).toHaveAttribute('data-points', '30');
  });

  it('renders empty state message when data is empty', () => {
    render(<DailyConversationActivityLine data={[]} />);
    expect(screen.getByText(/No daily activity data/)).toBeInTheDocument();
    expect(screen.queryByTestId('recharts-line-chart')).not.toBeInTheDocument();
  });

  it('renders accessible figure with aria-label', () => {
    render(<DailyConversationActivityLine data={makeData(5)} />);
    expect(screen.getByRole('figure')).toBeInTheDocument();
  });

  it('renders sr-only table with correct row count', () => {
    const data = makeData(3);
    render(<DailyConversationActivityLine data={data} />);
    const rows = screen.getAllByRole('row');
    // 1 header row + 3 data rows = 4
    expect(rows).toHaveLength(4);
  });
});
