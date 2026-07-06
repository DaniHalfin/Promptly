import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { getChartColors } from '../../../lib/chart-colors.js';

interface TokenRatioBarProps {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
}

export function TokenRatioBar({
  inputTokens,
  outputTokens,
  cachedTokens,
}: TokenRatioBarProps) {
  // WP-11: resolve chart colours from CSS custom properties
  const COLORS = getChartColors();
  const data = useMemo(() => {
    const chartData = [];
    
    if (inputTokens > 0) {
      chartData.push({
        name: 'Input Tokens',
        value: inputTokens,
        fill: COLORS[0],
      });
    }
    
    if (outputTokens > 0) {
      chartData.push({
        name: 'Output Tokens',
        value: outputTokens,
        fill: COLORS[1],
      });
    }
    
    if (cachedTokens && cachedTokens > 0) {
      chartData.push({
        name: 'Cached Tokens',
        value: cachedTokens,
        fill: COLORS[2],
      });
    }
    
    return chartData;
  }, [inputTokens, outputTokens, cachedTokens]);

  if (data.length === 0) {
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
    <figure aria-label="Token usage breakdown">
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr><th scope="col">Token type</th><th scope="col">Count</th></tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.value.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="name" type="category" width={140} />
          <Tooltip
            formatter={(value) => {
              if (typeof value === 'number') {
                return value.toLocaleString();
              }
              return value;
            }}
            contentStyle={{
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
            }}
          />
          <Bar dataKey="value" fill="#8884d8" radius={[0, 8, 8, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
