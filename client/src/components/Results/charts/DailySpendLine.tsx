import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getChartColors } from '../../../lib/chart-colors.js';

interface DailySpendLineProps {
  data: Array<{ date: string; costUsd: number }>;
}

export function DailySpendLine({ data }: DailySpendLineProps) {
  // WP-11: resolve chart colours from CSS custom properties; fall back to OKLCH constants
  const COLORS = getChartColors();

  if (!data || data.length === 0) {
    return (
      <figure aria-label="Daily spend over time">
        <div
          data-testid="chart-empty"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '20rem',
            background: 'var(--color-bg-inset)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No daily spend data for this period.</p>
        </div>
      </figure>
    );
  }

  return (
    // WP-9: <figure> provides semantic chart container; sr-only table exposes data to screen readers
    <figure aria-label="Daily spend over time">
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr><th scope="col">Date</th><th scope="col">Daily Spend (USD)</th></tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.date}>
                <td>{row.date}</td>
                <td>${row.costUsd.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis label={{ value: 'Daily Spend (USD)', angle: -90, position: 'insideLeft', dx: -10 }} />
          <Tooltip
            formatter={(value, name) => {
              const label = name === 'costUsd' ? 'Daily Spend' : name;
              if (typeof value === 'number') {
                return [`$${value.toFixed(2)}`, label];
              }
              return [value, label];
            }}
            contentStyle={{
              backgroundColor: 'var(--chart-tooltip-bg)',
              border: '1px solid var(--chart-tooltip-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--chart-tooltip-text)',
            }}
            labelStyle={{ color: 'var(--chart-tooltip-text)' }}
            itemStyle={{ color: 'var(--chart-tooltip-text)' }}
          />
          <Line
            type="monotone"
            dataKey="costUsd"
            name="Daily Spend"
            stroke={COLORS[0]}
            dot={{ fill: COLORS[0], r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
