import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { friendlyModelName } from '../../../lib/modelNames.js';
import { getChartColors } from '../../../lib/chart-colors.js';

interface ModelCostSharePieProps {
  data: Array<{ model: string; costUsd: number; percentage: number }>;
}

// WP-11: colours now sourced from CSS custom properties via getChartColors();
// hardcoded OKLCH strings serve as fallbacks when custom properties are absent.
// (Previously: hardcoded const COLORS = [...oklch values...])
const RADIAN = Math.PI / 180;

function renderCustomizedLabel({
  cx, cy, midAngle, innerRadius, outerRadius, percent,
}: {
  cx: number; cy: number; midAngle: number;
  innerRadius: number; outerRadius: number; percent: number;
}) {
  if (percent * 100 < 5) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
}

function renderLegendText(value: string) {
  return (
    <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-note)' }}>
      {friendlyModelName(value)}
    </span>
  );
}

export function ModelCostSharePie({ data }: ModelCostSharePieProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, background: 'var(--color-bg-inset)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-note)' }}>No data available</p>
      </div>
    );
  }

  // Ensure we have valid numeric data for the pie chart
  const validData = data.filter(d => d.costUsd > 0);

  if (validData.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, background: 'var(--color-bg-inset)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-note)' }}>No data available</p>
      </div>
    );
  }

  // WP-11: resolve at render time so theme changes are reflected without a page reload
  const COLORS = getChartColors();

  return (
    // WP-9: <figure> provides semantic chart container; sr-only table exposes data to screen readers
    <figure aria-label="Model cost share">
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr><th scope="col">Model</th><th scope="col">Cost (USD)</th><th scope="col">Percentage</th></tr>
          </thead>
          <tbody>
            {validData.map((row) => (
              <tr key={row.model}>
                <td>{friendlyModelName(row.model)}</td>
                <td>${row.costUsd.toFixed(4)}</td>
                <td>{row.percentage.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={validData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={100}
            innerRadius={60}
            fill="#8884d8"
            dataKey="costUsd"
            nameKey="model"
          >
            {validData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => {
              const numVal = typeof value === 'number' ? value : parseFloat(String(value));
              return [`$${numVal.toFixed(2)}`, friendlyModelName(String(name))];
            }}
            contentStyle={{
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
            }}
          />
          <Legend formatter={renderLegendText} />
        </PieChart>
      </ResponsiveContainer>
    </figure>
  );
}
