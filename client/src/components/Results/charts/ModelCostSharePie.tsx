import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ModelCostSharePieProps {
  data: Array<{ model: string; costUsd: number; percentage: number }>;
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];

export function ModelCostSharePie({ data }: ModelCostSharePieProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 bg-slate-50 rounded border border-slate-200">
        <p className="text-slate-500">No data available</p>
      </div>
    );
  }

  // Ensure we have valid numeric data for the pie chart
  const validData = data.filter(d => d.costUsd > 0);
  
  if (validData.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 bg-slate-50 rounded border border-slate-200">
        <p className="text-slate-500">No data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={validData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={(entry) => `${entry.model}: ${entry.percentage.toFixed(1)}%`}
          outerRadius={100}
          innerRadius={60}
          fill="#8884d8"
          dataKey="costUsd"
        >
          {validData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
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
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
