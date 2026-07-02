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
        <div className="flex items-center justify-center h-80 bg-slate-50 rounded border border-slate-200">
          <p className="text-slate-500">No data available</p>
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
            <tr><th scope="col">Date</th><th scope="col">Cost (USD)</th></tr>
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
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis label={{ value: 'Cost (USD)', angle: -90, position: 'insideLeft' }} />
          <Tooltip
            formatter={(value) => {
              if (typeof value === 'number') {
                return `$${value.toFixed(2)}`;
              }
              return value;
            }}
            contentStyle={{
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
            }}
          />
          <Line
            type="monotone"
            dataKey="costUsd"
            stroke={COLORS[0]}
            dot={{ fill: COLORS[0], r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
