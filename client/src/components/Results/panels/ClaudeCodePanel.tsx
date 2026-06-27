import React from 'react';
import { SourceReport } from '../../../types/index.js';
import { DailySpendLine } from '../charts/DailySpendLine.js';
import { ModelCostSharePie } from '../charts/ModelCostSharePie.js';
import { friendlyModelName } from '../../../lib/modelNames.js';

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
      <div className="card">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-indigo-600 rounded-full mr-3" />
          <h2 className="text-lg font-semibold">Claude Code</h2>
          <span style={{ marginLeft: 8, padding: '2px 8px', background: 'var(--color-accent-muted)', color: 'var(--color-accent-light)', fontSize: 'var(--text-note)', fontWeight: 600, borderRadius: 'var(--radius-sm)' }}>
            {tier || 'N/A'}
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>No data available</p>
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
    model: friendlyModelName(model.model),
    costUsd: model.estimatedCostUsd,
    percentage: totalSpend > 0 ? (model.estimatedCostUsd / totalSpend) * 100 : 0,
  }));
  const cachedTokenFraction = metrics.cachedTokenFractionClaudeCode;
  const cachedTokenSavingsUsd = metrics.cachedTokenSavingsUsdClaudeCode ?? 0;
  const peakHourFraction = metrics.claudeCodePeakHourFraction;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-indigo-600 rounded-full mr-3" />
          <h2 className="text-lg font-semibold">Claude Code</h2>
          <span style={{ marginLeft: 8, padding: '2px 8px', background: 'var(--color-accent-muted)', color: 'var(--color-accent-light)', fontSize: 'var(--text-note)', fontWeight: 600, borderRadius: 'var(--radius-sm)' }}>
            Tier {tier || 'N/A'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card-inset">
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginBottom: 4 }}>Total spend</p>
          <p className="kpi-large num" style={{ color: 'var(--color-positive-text)' }}>{formatUsd(totalSpend)}</p>
        </div>
        <div className="card-inset">
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginBottom: 4 }}>Sessions</p>
          <p className="kpi-large num" style={{ color: 'var(--text-primary)' }}>
            {(metrics.claudeCodeSessionCount ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="card-inset">
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginBottom: 4 }}>Avg tokens per session</p>
          <p className="kpi-large num" style={{ color: 'var(--text-primary)' }}>
            {formatTokens(metrics.claudeCodeAvgTokensPerSession)}
          </p>
        </div>
      </div>

      {peakHourFraction !== undefined && (
        <div className="card-inset mb-6">
          <p style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Peak hour sessions</p>
          <p className="kpi-large num" style={{ color: 'var(--color-accent-light)' }}>{(peakHourFraction * 100).toFixed(1)}%</p>
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginTop: 4 }}>of sessions occurred during peak hours.</p>
        </div>
      )}

      {dailySpendData.length > 0 && (
        <div className="mb-6">
          <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '-0.01em' }}>Daily Spend Trend</h3>
          <DailySpendLine data={dailySpendData} />
        </div>
      )}

      {modelBreakdown.length > 0 && (
        <div className="mb-6">
          <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '-0.01em' }}>Model cost breakdown</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ModelCostSharePie data={pieData} />
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <th style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingBottom: 8, textAlign: 'left' }}>Model</th>
                    <th style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingBottom: 8, textAlign: 'right' }}>Cost</th>
                    <th style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingBottom: 8, textAlign: 'right' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {modelBreakdown.map(model => (
                    <tr key={model.model} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 100ms' }}>
                      <td style={{ color: 'var(--text-primary)', fontSize: 'var(--text-body)', padding: '8px 0' }}>{friendlyModelName(model.model)}</td>
                      <td className="text-right" style={{ color: 'var(--text-primary)', fontSize: 'var(--text-body)' }}>{formatUsd(model.estimatedCostUsd)}</td>
                      <td className="text-right" style={{ color: 'var(--text-primary)', fontSize: 'var(--text-body)' }}>
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
        <div className="card-inset mb-6">
          <p style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--color-positive-text)', marginBottom: 4 }}>Prompt cache impact</p>
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)' }}>
            {(cachedTokenFraction * 100).toFixed(1)}% of input tokens were served from cache, saving approximately{' '}
            {formatUsd(cachedTokenSavingsUsd)}.
          </p>
        </div>
      )}

    </div>
  );
}
