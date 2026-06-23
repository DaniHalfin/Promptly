import React from 'react';
import { SourceReport } from '../../../types/index.js';
import { DailySpendLine } from '../charts/DailySpendLine.js';
import { ModelCostSharePie } from '../charts/ModelCostSharePie.js';

interface ClaudeCodePanelProps {
  report: SourceReport;
}

const formatUsd = (value: number) => `$${value.toFixed(2)}`;

const formatTokens = (value: number | undefined) => {
  if (value === undefined || Number.isNaN(value)) return '—';
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k tokens`;
};

export function ClaudeCodePanel({ report }: ClaudeCodePanelProps) {
  const { metrics, tier } = report;

  if (!metrics) {
    return (
      <div className="border rounded-lg p-6 bg-slate-50">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-indigo-600 rounded-full mr-3" />
          <h2 className="text-lg font-semibold">Claude Code</h2>
          <span className="ml-2 px-2 py-1 bg-gray-200 text-gray-800 text-xs font-semibold rounded">
            {tier || 'N/A'}
          </span>
        </div>
        <p className="text-slate-600">No data available</p>
      </div>
    );
  }

  const totalSpend = metrics.totalActualSpendUsd ?? 0;
  const modelBreakdown = [...(metrics.modelBreakdown ?? [])].sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd);
  const dailySpendData = (metrics.dailySpend ?? []).map(day => ({
    date: day.date,
    costUsd: day.spendUsd,
  }));
  const pieData = modelBreakdown.map(model => ({
    model: model.model,
    costUsd: model.estimatedCostUsd,
    percentage: totalSpend > 0 ? (model.estimatedCostUsd / totalSpend) * 100 : 0,
  }));
  const cachedTokenFraction = metrics.cachedTokenFractionClaudeCode;
  const cachedTokenSavingsUsd = metrics.cachedTokenSavingsUsdClaudeCode ?? 0;
  const peakHourFraction = metrics.claudeCodePeakHourFraction;

  return (
    <div className="border rounded-lg p-6 bg-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-indigo-600 rounded-full mr-3" />
          <h2 className="text-lg font-semibold">Claude Code</h2>
          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
            Tier {tier || 'N/A'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 rounded p-4">
          <p className="text-sm text-slate-600">Total spend</p>
          <p className="text-2xl font-bold text-purple-600">{formatUsd(totalSpend)}</p>
        </div>
        <div className="bg-slate-50 rounded p-4">
          <p className="text-sm text-slate-600">Sessions</p>
          <p className="text-2xl font-bold text-slate-900">
            {(metrics.claudeCodeSessionCount ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-slate-50 rounded p-4">
          <p className="text-sm text-slate-600">Avg tokens per session</p>
          <p className="text-2xl font-bold text-indigo-600">
            {formatTokens(metrics.claudeCodeAvgTokensPerSession)}
          </p>
        </div>
      </div>

      {peakHourFraction !== undefined && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded p-4">
          <p className="text-sm font-semibold text-blue-900">Peak hour sessions</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{(peakHourFraction * 100).toFixed(1)}%</p>
          <p className="text-sm text-blue-800 mt-1">of sessions occurred during peak hours.</p>
        </div>
      )}

      {dailySpendData.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-4">Daily Spend Trend</h3>
          <DailySpendLine data={dailySpendData} />
        </div>
      )}

      {modelBreakdown.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-4">Model cost breakdown</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ModelCostSharePie data={pieData} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-semibold">Model</th>
                    <th className="text-right py-2 font-semibold">Cost</th>
                    <th className="text-right py-2 font-semibold">%</th>
                  </tr>
                </thead>
                <tbody>
                  {modelBreakdown.map(model => (
                    <tr key={model.model} className="border-b hover:bg-slate-50">
                      <td className="py-2">{model.model}</td>
                      <td className="text-right">{formatUsd(model.estimatedCostUsd)}</td>
                      <td className="text-right">
                        {totalSpend > 0 ? ((model.estimatedCostUsd / totalSpend) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {cachedTokenFraction !== undefined && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-sm font-semibold text-green-900">Prompt cache impact</p>
          <p className="text-sm text-green-800 mt-1">
            {(cachedTokenFraction * 100).toFixed(1)}% of input tokens were served from cache, saving approximately{' '}
            {formatUsd(cachedTokenSavingsUsd)}.
          </p>
        </div>
      )}

    </div>
  );
}
