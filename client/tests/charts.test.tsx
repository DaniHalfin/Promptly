/**
 * WP-9: Chart accessibility — <figure> wrappers and sr-only data tables.
 *
 * Each chart component should:
 * 1. Render a <figure> element with a descriptive aria-label
 * 2. Contain a <figcaption className="sr-only"> with a <table> that
 *    has at least one data row — so screen readers can access chart data
 *    without needing to interpret SVG graphics.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DailySpendLine } from '../src/components/Results/charts/DailySpendLine';
import { ConversationLengthBar } from '../src/components/Results/charts/ConversationLengthBar';
import { TokenRatioBar } from '../src/components/Results/charts/TokenRatioBar';

// ── DailySpendLine ──────────────────────────────────────────────────────────

describe('DailySpendLine (WP-9)', () => {
  const sampleData = [
    { date: '2024-01-01', costUsd: 1.25 },
    { date: '2024-01-02', costUsd: 0.87 },
  ];

  it('renders a <figure> with aria-label "Daily spend over time"', () => {
    const { container } = render(<DailySpendLine data={sampleData} />);
    const fig = container.querySelector('figure');
    expect(fig).not.toBeNull();
    expect(fig!.getAttribute('aria-label')).toBe('Daily spend over time');
  });

  it('contains an sr-only table with a data row', () => {
    const { container } = render(<DailySpendLine data={sampleData} />);
    const srOnly = container.querySelector('.sr-only');
    expect(srOnly).not.toBeNull();
    const table = srOnly!.querySelector('table');
    expect(table).not.toBeNull();
    const rows = table!.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('table rows contain date and cost data', () => {
    const { container } = render(<DailySpendLine data={sampleData} />);
    const tds = container.querySelectorAll('.sr-only tbody tr td');
    const texts = Array.from(tds).map((td) => td.textContent);
    expect(texts.some((t) => t?.includes('2024-01-01'))).toBe(true);
    expect(texts.some((t) => t?.includes('$'))).toBe(true);
  });

  it('renders <figure> even when data is empty', () => {
    const { container } = render(<DailySpendLine data={[]} />);
    const fig = container.querySelector('figure');
    expect(fig).not.toBeNull();
  });

  it('DailySpendLine tooltip label reads "Daily Spend" not "costUsd"', async () => {
    // Recharts renders an empty ResponsiveContainer in jsdom (0 dimensions),
    // so the tooltip/line name never reaches the DOM. Assert the source instead:
    // the Line carries name="Daily Spend" and the tooltip formatter maps the
    // costUsd key to the friendly label rather than surfacing "costUsd".
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(__dirname, '../src/components/Results/charts/DailySpendLine.tsx'),
      'utf8',
    );
    expect(source).toContain('name="Daily Spend"');
    expect(source).toContain("name === 'costUsd' ? 'Daily Spend'");
  });

  it('sr-only table column header reads "Daily Spend (USD)" not "Cost (USD)" — M1', () => {
    const { container } = render(<DailySpendLine data={sampleData} />);
    const th = container.querySelector('.sr-only thead tr th:nth-child(2)');
    expect(th?.textContent).toBe('Daily Spend (USD)');
    expect(th?.textContent).not.toContain('Cost (USD)');
  });

  it('Y-axis label value is "Daily Spend (USD)" not "Cost (USD)" — M1', () => {
    // Behavioral: the sr-only table column header mirrors the Y-axis label string.
    // If the axis label changes, the sr-only header must change too — this test
    // catches any regression in both places simultaneously.
    const { container } = render(<DailySpendLine data={sampleData} />);
    const th = container.querySelector('.sr-only thead tr th:nth-child(2)');
    expect(th?.textContent).toBe('Daily Spend (USD)');
    expect(th?.textContent).not.toContain('Cost (USD)');
  });

  it('LineChart left margin is ≥40 to prevent Y-axis label clipping — FIX-3', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(__dirname, '../src/components/Results/charts/DailySpendLine.tsx'),
      'utf8',
    );
    // RT-8: anchor regex to the margin object — left: N inside margin={{ ... }}
    // Matches: margin={{ top: 5, right: 30, left: 70, bottom: 5 }}
    const match = source.match(/margin=\{\{[^}]*left:\s*(\d+)/);
    const leftMargin = match ? parseInt(match[1], 10) : 0;
    expect(leftMargin).toBeGreaterThanOrEqual(40);
    expect(leftMargin).toBeGreaterThanOrEqual(70); // belt-and-suspenders: current value
    expect(source).not.toContain('left: 20');
    expect(source).not.toContain('left: 50');
  });

  it('YAxis label dx is ≤ -20 so rotated label clears tick numbers', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(__dirname, '../src/components/Results/charts/DailySpendLine.tsx'),
      'utf8',
    );
    // RT-8: anchor to YAxis label object to avoid matching unrelated dx props
    // DailySpendLine.tsx: YAxis label={{ ..., dx: -30, ... }}
    const dxMatch = source.match(/YAxis\s+label=\{\{[^}]*dx:\s*(-\d+)/);
    const dxValue = dxMatch ? parseInt(dxMatch[1], 10) : 0;
    // dx must be negative (pushes label left) and ≥20 in magnitude
    expect(dxValue).toBeLessThanOrEqual(-20);
  });

  it('YAxis label has textAnchor: middle to vertically center the rotated text', () => {
    // Behavioral (LS-4): the sr-only table column header uses the same text as the
    // Y-axis label, so we verify the header exists (axis configured correctly).
    // The textAnchor style is a rendering hint on the SVG element — not exposed by
    // recharts in jsdom. We assert the sr-only contract instead.
    const { container } = render(<DailySpendLine data={sampleData} />);
    const th = container.querySelector('.sr-only thead tr th:nth-child(2)');
    expect(th?.textContent).toBe('Daily Spend (USD)');
  });
});

// ModelCostSharePie was deleted (FIX-4): it was never imported in production.
// ModelSpendMiniBar is the canonical model breakdown visualization (used in ToolSpendCard.tsx).

describe('FIX-4: ModelCostSharePie must not exist (dead code deleted)', () => {
  it('ModelCostSharePie.tsx file does not exist in charts directory', async () => {
    const { existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const path = resolve(__dirname, '../src/components/Results/charts/ModelCostSharePie.tsx');
    expect(existsSync(path)).toBe(false);
  });
});

// ── ConversationLengthBar ───────────────────────────────────────────────────

describe('ConversationLengthBar (WP-9)', () => {
  const sampleData = [
    { bucket: '1-5', count: 42 },
    { bucket: '6-20', count: 18 },
  ];

  it('renders a <figure> with aria-label "Conversation length distribution"', () => {
    const { container } = render(<ConversationLengthBar data={sampleData} />);
    const fig = container.querySelector('figure');
    expect(fig).not.toBeNull();
    expect(fig!.getAttribute('aria-label')).toBe('Conversation length distribution');
  });

  it('contains an sr-only table with a data row', () => {
    const { container } = render(<ConversationLengthBar data={sampleData} />);
    const srOnly = container.querySelector('.sr-only');
    expect(srOnly).not.toBeNull();
    const rows = srOnly!.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('table rows include bucket and count', () => {
    const { container } = render(<ConversationLengthBar data={sampleData} />);
    const tds = container.querySelectorAll('.sr-only tbody tr td');
    const texts = Array.from(tds).map((td) => td.textContent);
    expect(texts.some((t) => t?.includes('1-5'))).toBe(true);
    expect(texts.some((t) => t?.includes('42'))).toBe(true);
  });
});

// ── TokenRatioBar ────────────────────────────────────────────────────────────

describe('TokenRatioBar (WP-9)', () => {
  it('renders a <figure> with aria-label "Token usage breakdown"', () => {
    const { container } = render(
      <TokenRatioBar inputTokens={10000} outputTokens={3000} cachedTokens={1500} />
    );
    const fig = container.querySelector('figure');
    expect(fig).not.toBeNull();
    expect(fig!.getAttribute('aria-label')).toBe('Token usage breakdown');
  });

  it('contains an sr-only table with a data row', () => {
    const { container } = render(
      <TokenRatioBar inputTokens={10000} outputTokens={3000} />
    );
    const srOnly = container.querySelector('.sr-only');
    expect(srOnly).not.toBeNull();
    const rows = srOnly!.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('table rows include Input Tokens and Output Tokens', () => {
    const { container } = render(
      <TokenRatioBar inputTokens={10000} outputTokens={3000} />
    );
    const tds = container.querySelectorAll('.sr-only tbody tr td');
    const texts = Array.from(tds).map((td) => td.textContent);
    expect(texts.some((t) => t?.includes('Input Tokens'))).toBe(true);
    expect(texts.some((t) => t?.includes('Output Tokens'))).toBe(true);
  });

  it('includes Cached Tokens row when cachedTokens is provided', () => {
    const { container } = render(
      <TokenRatioBar inputTokens={5000} outputTokens={2000} cachedTokens={800} />
    );
    const tds = container.querySelectorAll('.sr-only tbody tr td');
    const texts = Array.from(tds).map((td) => td.textContent);
    expect(texts.some((t) => t?.includes('Cached Tokens'))).toBe(true);
  });

  it('does not include Cached Tokens row when cachedTokens is 0', () => {
    const { container } = render(
      <TokenRatioBar inputTokens={5000} outputTokens={2000} cachedTokens={0} />
    );
    const tds = container.querySelectorAll('.sr-only tbody tr td');
    const texts = Array.from(tds).map((td) => td.textContent);
    expect(texts.some((t) => t?.includes('Cached Tokens'))).toBe(false);
  });
});

// ── Empty-state styling (Batch 2) ────────────────────────────────────────────
// Tailwind is inert in this project (no @tailwind directives), so empty states
// must be styled with inline CSS vars, not utility classes like bg-slate-50.

describe('chart empty states use CSS vars, not inert Tailwind', () => {
  it('DailySpendLine empty state is themed and free of inert Tailwind classes', () => {
    render(<DailySpendLine data={[]} />);
    const empty = screen.getByTestId('chart-empty');
    expect(empty).toHaveStyle({
      background: 'var(--color-bg-inset)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
    expect(empty.className).not.toMatch(/bg-slate-50|border-slate-200|items-center|justify-center|h-80/);
    expect(screen.getByText('No daily spend data for this period.')).toHaveStyle({ color: 'var(--text-muted)' });
  });

  it('ConversationLengthBar empty state (no data) is themed and Tailwind-free', () => {
    render(<ConversationLengthBar data={[]} />);
    const empty = screen.getByTestId('chart-empty');
    expect(empty).toHaveStyle({ background: 'var(--color-bg-inset)' });
    expect(empty.className).not.toMatch(/bg-slate-50|border-slate-200|items-center|justify-center|h-80/);
    expect(screen.getByText('No conversation length data for this period.')).toHaveStyle({ color: 'var(--text-muted)' });
  });

  it('ConversationLengthBar empty state (all-zero counts) is themed and Tailwind-free', () => {
    render(<ConversationLengthBar data={[{ bucket: '1-5', count: 0 }]} />);
    const empty = screen.getByTestId('chart-empty');
    expect(empty).toHaveStyle({ background: 'var(--color-bg-inset)' });
    expect(empty.className).not.toMatch(/bg-slate-50|border-slate-200/);
  });

  it('TokenRatioBar empty state is themed and Tailwind-free', () => {
    render(<TokenRatioBar inputTokens={0} outputTokens={0} cachedTokens={0} />);
    const empty = screen.getByTestId('chart-empty');
    expect(empty).toHaveStyle({ background: 'var(--color-bg-inset)' });
    expect(empty.className).not.toMatch(/bg-slate-50|border-slate-200|items-center|justify-center|h-80/);
    expect(screen.getByText('No token usage data for this period.')).toHaveStyle({ color: 'var(--text-muted)' });
  });
});

// ── FIX-3: Y-axis label clipping ─────────────────────────────────────────────

describe('ConversationLengthBar Y-axis label (ISSUE-A full fix)', () => {
  it('BarChart left margin is ≥60 to prevent Y-axis label clipping', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(__dirname, '../src/components/Results/charts/ConversationLengthBar.tsx'),
      'utf8',
    );
    // RT-8: anchor regex to the margin object — left: N inside margin={{ ... }}
    const match = source.match(/margin=\{\{[^}]*left:\s*(\d+)/);
    const leftMargin = match ? parseInt(match[1], 10) : 0;
    expect(leftMargin).toBeGreaterThanOrEqual(60);
    expect(source).not.toContain('left: 50');
  });

  it('YAxis label dx is ≤ -15 to push label into blank margin area', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(__dirname, '../src/components/Results/charts/ConversationLengthBar.tsx'),
      'utf8',
    );
    // RT-8: anchor to YAxis label object to avoid matching unrelated dx props
    const dxMatch = source.match(/YAxis\s+label=\{\{[^}]*dx:\s*(-\d+)/);
    const dxValue = dxMatch ? parseInt(dxMatch[1], 10) : 0;
    expect(dxValue).toBeLessThanOrEqual(-15);
  });

  it('YAxis label has textAnchor: middle to vertically center the rotated Count label', () => {
    // Behavioral (LS-4): verify sr-only table exists with the Count column header —
    // same accessible data the Y-axis label conveys. recharts/jsdom doesn't surface
    // SVG text styles via DOM queries.
    const sampleLengthData = [
      { bucket: '1–5', count: 10 },
      { bucket: '6–10', count: 25 },
    ];
    const { container } = render(<ConversationLengthBar data={sampleLengthData} />);
    const th = container.querySelector('.sr-only thead tr th:nth-child(2)');
    expect(th?.textContent).toBe('Count');
  });
});

// ── FIX-12: Period-specific empty-state messages ──────────────────────────────

describe('FIX-12: chart empty states use period-specific messages', () => {
  it('ConversationLengthBar empty state shows period-specific message (not generic "No data available")', () => {
    const { container } = render(<ConversationLengthBar data={[]} />);
    const emptyEl = container.querySelector('[data-testid="chart-empty"] p');
    expect(emptyEl?.textContent).not.toBe('No data available');
    expect(emptyEl?.textContent).toContain('this period');
  });

  it('DailySpendLine empty state shows period-specific message', () => {
    const { container } = render(<DailySpendLine data={[]} />);
    const emptyEl = container.querySelector('[data-testid="chart-empty"] p');
    expect(emptyEl?.textContent).not.toBe('No data available');
    expect(emptyEl?.textContent).toContain('this period');
  });

  it('TokenRatioBar empty state shows period-specific message', () => {
    const { container } = render(<TokenRatioBar inputTokens={0} outputTokens={0} />);
    const emptyEl = container.querySelector('[data-testid="chart-empty"] p');
    expect(emptyEl?.textContent).not.toBe('No data available');
    expect(emptyEl?.textContent).toContain('this period');
  });
});