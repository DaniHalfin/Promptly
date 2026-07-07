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
import { getChartColors } from '../../lib/chart-colors.js';
import type { DailyConversationActivityEntry } from '../../types/index.js';

interface DailyConversationActivityLineProps {
  data: DailyConversationActivityEntry[];
}

export function DailyConversationActivityLine({ data }: DailyConversationActivityLineProps) {
  const COLORS = getChartColors();

  if (!data || data.length === 0) {
    return (
      <figure aria-label="Daily conversation activity">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, background: 'var(--color-bg-inset)', borderRadius: 'var(--radius-lg)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No daily activity data</p>
        </div>
      </figure>
    );
  }

  return (
    // WP-9: <figure> with sr-only data table for accessibility
    <figure aria-label="Daily conversation activity">
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr><th scope="col">Date</th><th scope="col">Conversations</th></tr>
          </thead>
          <tbody>
            {data.map(row => (
              <tr key={row.date}>
                <td>{row.date}</td>
                <td>{row.conversation_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(value: number) => [value, 'Conversations']}
            contentStyle={{ fontSize: '0.75rem' }}
          />
          <Line
            type="monotone"
            dataKey="conversation_count"
            stroke={COLORS[0]}
            dot={false}
            strokeWidth={1.5}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
