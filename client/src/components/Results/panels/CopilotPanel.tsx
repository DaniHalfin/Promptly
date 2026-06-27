import React from 'react';
import { SourceReport } from '../../../types/index.js';
import { ModelCostSharePie } from '../charts/ModelCostSharePie.js';
import { friendlyModelName } from '../../../lib/modelNames.js';

interface CopilotPanelProps {
  report: SourceReport;
}

export function CopilotPanel({ report }: CopilotPanelProps) {
  const { metrics, tier } = report;

  if (!metrics) {
    return (
      <div className="card">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-blue-600 rounded-full mr-3" />
          <h2 className="text-lg font-semibold">GitHub Copilot</h2>
          <span style={{ marginLeft: 8, padding: '2px 6px', background: 'var(--color-accent-muted)', color: 'var(--color-accent-light)', fontSize: 'var(--text-note)', fontWeight: 600, borderRadius: 'var(--radius-sm)' }}>{tier || 'N/A'}</span>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>No data available</p>
      </div>
    );
  }

  const totalCost = metrics.copilotTotalCostUsd ?? 0;
  const sessionCount = metrics.copilotSessionCount ?? 0;
  const tokenBreakdown = metrics.copilotTokenBreakdownByModel ?? [];
  const modelCostBreakdown = metrics.copilotModelCostBreakdown ?? [];
  const sortedModelCostBreakdown = [...modelCostBreakdown].sort((a, b) => b.costUsd - a.costUsd);
  const cachedFraction = metrics.copilotCachedTokenFraction;

  const totalInputTokens = tokenBreakdown.reduce((sum, m) => sum + m.inputTokens, 0);
  const totalOutputTokens = tokenBreakdown.reduce((sum, m) => sum + m.outputTokens, 0);

  const pieData = modelCostBreakdown
    .map(model => ({ model: friendlyModelName(model.model), costUsd: model.costUsd, percentage: model.costShare * 100 }))
    .filter(model => model.percentage > 0);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-blue-600 rounded-full mr-3" />
          <h2 className="text-lg font-semibold">GitHub Copilot</h2>
          {(tier === 'A' || tier === 'B') && (
            <span style={{ marginLeft: 8, padding: '2px 6px', background: 'var(--color-positive-muted)', color: 'var(--color-positive-text)', fontSize: 'var(--text-note)', fontWeight: 600, borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-positive)' }}>
              Connected
            </span>
          )}
        </div>
      </div>

      <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginBottom: 24 }}>
        Covers Chat, CLI, cloud agent, and Spaces. Code completions are unlimited and not billed here.
      </p>

      {/* 1: KPI tiles */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card-inset">
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginBottom: 4 }}>Total Cost</p>
          <p className="kpi-large num" style={{ color: 'var(--color-accent-light)' }}>${totalCost.toFixed(2)}</p>
        </div>
        <div className="card-inset">
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginBottom: 4 }}>Sessions</p>
          <p className="kpi-large num" style={{ color: 'var(--text-primary)' }}>{sessionCount.toLocaleString()}</p>
        </div>
        <div className="card-inset">
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginBottom: 4 }}>Total Tokens</p>
          <p className="kpi-large num" style={{ color: 'var(--text-primary)' }}>{(totalInputTokens + totalOutputTokens).toLocaleString()}</p>
        </div>
      </div>

      {/* 2: Token breakdown table */}
      {tokenBreakdown.length > 0 && (
        <div className="mb-6">
          <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '-0.01em' }}>Token breakdown by model</h3>
          <div className="table-scroll">
            <table className="w-full text-sm" data-testid="token-breakdown-table">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <th className="text-left" style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingBottom: 8 }}>Model</th>
                  <th className="text-right" style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingBottom: 8 }}>Input tokens</th>
                  <th className="text-right" style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingBottom: 8 }}>Output tokens</th>
                  <th className="text-right" style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingBottom: 8 }}>Cache read</th>
                  <th className="text-right" style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingBottom: 8 }}>Cache write</th>
                  <th className="text-right" style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingBottom: 8 }}>Reasoning</th>
                  <th className="text-right" style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingBottom: 8 }}>Requests</th>
                  <th className="text-right" style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingBottom: 8 }}>Cost (USD)</th>
                </tr>
              </thead>
              <tbody>
                {tokenBreakdown.map(row => (
                  <tr key={row.model} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 100ms' }}>
                    <td style={{ color: 'var(--text-primary)', fontSize: 'var(--text-body)', padding: '8px 0' }}>{friendlyModelName(row.model)}</td>
                    <td className="text-right" style={{ color: 'var(--text-primary)', fontSize: 'var(--text-body)' }}>{row.inputTokens.toLocaleString()}</td>
                    <td className="text-right" style={{ color: 'var(--text-primary)', fontSize: 'var(--text-body)' }}>{row.outputTokens.toLocaleString()}</td>
                    <td className="text-right" style={{ color: 'var(--text-primary)', fontSize: 'var(--text-body)' }}>{row.cacheReadTokens.toLocaleString()}</td>
                    <td className="text-right" style={{ color: 'var(--text-primary)', fontSize: 'var(--text-body)' }}>{row.cacheWriteTokens.toLocaleString()}</td>
                    <td className="text-right" style={{ color: 'var(--text-primary)', fontSize: 'var(--text-body)' }}>{row.reasoningTokens.toLocaleString()}</td>
                    <td className="text-right" style={{ color: 'var(--text-primary)', fontSize: 'var(--text-body)' }}>{row.requestCount.toLocaleString()}</td>
                    <td className="text-right" style={{ color: 'var(--text-primary)', fontSize: 'var(--text-body)' }}>${row.requestCost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3: Model spend breakdown */}
      {modelCostBreakdown.length > 0 && (
        <div className="mb-6">
          <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '-0.01em' }}>Model spend</h3>
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <th className="text-left" style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingBottom: 8 }}>Model</th>
                  <th className="text-right" style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingBottom: 8 }}>Net spend</th>
                  <th className="text-right" style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingBottom: 8 }}>% of total</th>
                </tr>
              </thead>
              <tbody>
                {sortedModelCostBreakdown.map(model => (
                  <tr key={model.model} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 100ms' }}>
                    <td style={{ color: 'var(--text-primary)', fontSize: 'var(--text-body)', padding: '8px 0' }}>{friendlyModelName(model.model)}</td>
                    <td className="text-right" style={{ color: 'var(--text-primary)', fontSize: 'var(--text-body)' }}>${model.costUsd.toFixed(2)}</td>
                    <td className="text-right" style={{ color: 'var(--text-primary)', fontSize: 'var(--text-body)' }}>{(model.costShare * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4: Input / output token tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="card-inset">
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginBottom: 4 }}>Input tokens</p>
          <p className="kpi-large num" style={{ color: 'var(--text-primary)' }}>{totalInputTokens.toLocaleString()}</p>
          <p style={{ fontSize: 'var(--text-note)', color: 'var(--text-muted)', marginTop: 4 }}>Total prompt tokens (cached reads/writes are subsets, not additive)</p>
        </div>
        <div className="card-inset">
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginBottom: 4 }}>Output tokens</p>
          <p className="kpi-large num" style={{ color: 'var(--text-primary)' }}>{totalOutputTokens.toLocaleString()}</p>
          <p style={{ fontSize: 'var(--text-note)', color: 'var(--text-muted)', marginTop: 4 }}>Total completion tokens (reasoning subsets included)</p>
        </div>
      </div>

      {/* 5: Cache-read fraction */}
      {cachedFraction && (
        <div className="mb-6">
          <div className="card-inset mb-4" data-testid="cache-fraction-tile">
            <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginBottom: 4 }}>Cache-read fraction (aggregate)</p>
            <p className="kpi-large num" style={{ color: 'var(--color-positive-text)' }}>{(cachedFraction.aggregate * 100).toFixed(1)}%</p>
            <p style={{ fontSize: 'var(--text-note)', color: 'var(--text-muted)', marginTop: 4 }}>Higher cache-read fraction = lower effective cost per token</p>
          </div>
          {cachedFraction.perModel.length > 0 && (
            <div>
              <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '-0.01em' }}>Cache-read fraction by model</h3>
              <div className="space-y-2" data-testid="cache-fraction-bars">
                {cachedFraction.perModel.map(({ model, fraction }) => (
                  <div key={model}>
                    <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                      <span>{friendlyModelName(model)}</span>
                      <span>{(fraction * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'var(--color-positive)', borderRadius: 'var(--radius-pill)', width: `${Math.min(fraction * 100, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6: Model cost share pie */}
      {pieData.length > 0 && (
        <div className="mb-6">
          <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '-0.01em' }}>Model cost share</h3>
          <ModelCostSharePie data={pieData} />
        </div>
      )}

      <div className="card-inset">
        <p style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>How to optimize Copilot AI credits</p>
        <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)' }}>Review high-share models above and prefer lower-cost models for routine tasks when quality is sufficient.</p>
      </div>
    </div>
  );
}
