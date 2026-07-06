import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getChartColors } from '../../../lib/chart-colors.js';

interface ConversationLengthBarProps {
  data: Array<{ bucket: string; count: number }>;
}

export function ConversationLengthBar({ data }: ConversationLengthBarProps) {
  // WP-11: resolve chart colours from CSS custom properties
  const COLORS = getChartColors();
  if (!data || data.length === 0) {
    return (
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
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>No data available</p>
      </div>
    );
  }

  // Filter out zero counts for cleaner visualization
  const validData = data.filter(d => d.count > 0);
  
  if (validData.length === 0) {
    return (
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
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>No data available</p>
      </div>
    );
  }

  return (
    // WP-9: <figure> provides semantic chart container; sr-only table exposes data to screen readers
    <figure aria-label="Conversation length distribution">
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr><th scope="col">Length bucket</th><th scope="col">Count</th></tr>
          </thead>
          <tbody>
            {validData.map((row) => (
              <tr key={row.bucket}>
                <td>{row.bucket}</td>
                <td>{row.count.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={validData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="bucket" />
          <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
          <Tooltip
            formatter={(value) => {
              if (typeof value === 'number') {
                return value.toLocaleString();
              }
              return value;
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
          <Bar
            dataKey="count"
            fill={COLORS[0]}
            radius={[8, 8, 0, 0]}
            animationDuration={300}
          />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
