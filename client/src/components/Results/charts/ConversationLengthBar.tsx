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

interface ConversationLengthBarProps {
  data: Array<{ bucket: string; count: number }>;
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];

export function ConversationLengthBar({ data }: ConversationLengthBarProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 bg-slate-50 rounded border border-slate-200">
        <p className="text-slate-500">No data available</p>
      </div>
    );
  }

  // Filter out zero counts for cleaner visualization
  const validData = data.filter(d => d.count > 0);
  
  if (validData.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 bg-slate-50 rounded border border-slate-200">
        <p className="text-slate-500">No data available</p>
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
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
            }}
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
