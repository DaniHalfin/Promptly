import React from 'react';
import { SourceReport } from '../../../types/index.js';
import { DailySpendLine } from '../charts/DailySpendLine.js';
import { ModelCostSharePie } from '../charts/ModelCostSharePie.js';
import { TokenRatioBar } from '../charts/TokenRatioBar.js';
import { TierUpgradeNudge } from '../../common/TierUpgradeNudge.js';
import { friendlyModelName } from '../../../lib/modelNames.js';

interface OpenAIPanelProps {
  report: SourceReport;
}

export function OpenAIPanel({ report }: OpenAIPanelProps) {
  const { metrics, tier } = report;

  // ── Empty / no-metrics state ─────────────────────────────────────────────
  if (!metrics) {
    return (
      <div className="border rounded-lg p-6" style={{ background: 'var(--color-bg-surface)' }}>
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full mr-3" />
          <h2 style={{ fontSize: 'var(--text-title)', fontWeight: 600, color: 'var(--text-primary)' }}>
            OpenAI
          </h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body)' }}>No data available</p>
      </div>
    );
  }

  // ── Zero-data state ──────────────────────────────────────────────────────
  if (!metrics.totalActualSpendUsd && !metrics.modelBreakdown?.length) {
    return (
      <div className="border rounded-lg p-6" style={{ background: 'var(--color-bg-surface)' }}>
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full mr-3" />
          <h2 style={{ fontSize: 'var(--text-title)', fontWeight: 600, color: 'var(--text-primary)' }}>
            OpenAI
          </h2>
        </div>
        <p
          className="text-center py-8"
          style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body)' }}
        >
          $0.00 — No activity in this period
        </p>
      </div>
    );
  }

  // ── Tier A / B — full metrics ────────────────────────────────────────────
  if (tier === 'A' || tier === 'B') {
    const totalSpend = metrics.totalActualSpendUsd || 0;
    const modelBreakdown = metrics.modelBreakdown || [];

    const pieData = modelBreakdown.map(m => ({
      model: friendlyModelName(m.model),
      costUsd: m.estimatedCostUsd,
      percentage: totalSpend > 0 ? (m.estimatedCostUsd / totalSpend) * 100 : 0,
    }));

    const dailySpendData = (metrics.dailySpend || []).map(d => ({
      date: d.date,
      costUsd: d.spendUsd,
    }));

    const totalInputTokens  = modelBreakdown.reduce((sum, m) => sum + m.inputTokens, 0);
    const totalOutputTokens = modelBreakdown.reduce((sum, m) => sum + m.outputTokens, 0);
    const totalCachedTokens = modelBreakdown.reduce((sum, m) => sum + (m.cachedInputTokens || 0), 0);

    const topRecommendation = 'Monitor daily spend trends and optimize models for peak usage periods';

    return (
      <div className="border rounded-lg p-6" style={{ background: 'var(--color-bg-surface)' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full mr-3" />
            <h2 style={{ fontSize: 'var(--text-title)', fontWeight: 600, color: 'var(--text-primary)' }}>
              OpenAI
            </h2>
          </div>
          <p style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--color-positive-text)' }}>
            ${totalSpend.toFixed(2)}
          </p>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded p-4" style={{ background: 'var(--color-bg-inset)' }}>
            <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)' }}>Avg Daily Spend</p>
            <p style={{ fontSize: 'var(--text-title)', fontWeight: 600, color: 'var(--text-primary)' }}>
              ${(metrics.avgDailySpendUsd || 0).toFixed(2)}
            </p>
          </div>
          <div className="rounded p-4" style={{ background: 'var(--color-bg-inset)' }}>
            <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)' }}>Peak Day</p>
            {metrics.peakSpendDay ? (
              <p style={{ fontSize: 'var(--text-title)', fontWeight: 600, color: 'var(--text-primary)' }}>
                ${metrics.peakSpendDay.spendUsd.toFixed(2)}
              </p>
            ) : (
              <p style={{ fontSize: 'var(--text-title)', fontWeight: 600, color: 'var(--text-primary)' }}>—</p>
            )}
          </div>
        </div>

        {/* Daily Spend Chart */}
        {dailySpendData.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-4" style={{ fontSize: 'var(--text-heading)', fontWeight: 600, color: 'var(--text-primary)' }}>
              Daily Spend Trend
            </h3>
            <DailySpendLine data={dailySpendData} />
          </div>
        )}

        {/* Model Breakdown */}
        {modelBreakdown.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-1" style={{ fontSize: 'var(--text-heading)', fontWeight: 600, color: 'var(--text-primary)' }}>
              Estimated model cost breakdown — exact per-model billing data is not available from the OpenAI API.
            </h3>
            {modelBreakdown.some(m => m.estimated) && (
              <p className="mb-4" style={{ fontSize: 'var(--text-note)', color: 'var(--text-muted)' }}>
                * Estimated row
              </p>
            )}
            <div className="grid grid-cols-2 gap-6">
              {pieData.length > 0 && (
                <div>
                  <ModelCostSharePie data={pieData} />
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full" style={{ fontSize: 'var(--text-body)' }}>
                  <thead>
                    <tr className="border-b">
                      <th className="py-2" style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'left' }}>Model</th>
                      <th className="py-2" style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>Cost</th>
                      <th className="py-2" style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelBreakdown.map((m, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="py-2" style={{ color: 'var(--text-primary)' }}>
                          {friendlyModelName(m.model)}
                          {m.estimated && (
                            <span
                              className="ml-1"
                              title="Estimated model cost"
                              style={{ color: 'var(--color-info)' }}
                            >
                              *
                            </span>
                          )}
                        </td>
                        <td className="text-right" style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>
                          ${m.estimatedCostUsd.toFixed(2)}
                        </td>
                        <td className="text-right" style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>
                          {totalSpend > 0 ? ((m.estimatedCostUsd / totalSpend) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Token Distribution */}
        {(totalInputTokens > 0 || totalOutputTokens > 0) && (
          <div className="mb-6">
            <h3 className="mb-4" style={{ fontSize: 'var(--text-heading)', fontWeight: 600, color: 'var(--text-primary)' }}>
              Token Distribution
            </h3>
            <TokenRatioBar
              inputTokens={totalInputTokens}
              outputTokens={totalOutputTokens}
              cachedTokens={totalCachedTokens > 0 ? totalCachedTokens : undefined}
            />
          </div>
        )}

        {/* Recommendation */}
        <div
          className="rounded p-4 border"
          style={{ background: 'var(--color-accent-muted)', borderColor: 'var(--color-accent-border)' }}
        >
          <p style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Recommendation
          </p>
          <p className="mt-1" style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)' }}>
            {topRecommendation}
          </p>
        </div>
      </div>
    );
  }

  // ── Tier C — estimated metrics ───────────────────────────────────────────
  const estimatedSpend = metrics.estimatedRelativeCostUsd || 0;
  const modelBreakdown  = metrics.modelBreakdown || [];
  const pieData = modelBreakdown
    .filter(m => m.estimatedCostUsd > 0)
    .map(m => ({
      model: friendlyModelName(m.model),
      costUsd: m.estimatedCostUsd,
      percentage: estimatedSpend > 0 ? (m.estimatedCostUsd / estimatedSpend) * 100 : 0,
    }));

  return (
    <div className="border rounded-lg p-6" style={{ background: 'var(--color-bg-surface)' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full mr-3" />
          <h2 style={{ fontSize: 'var(--text-title)', fontWeight: 600, color: 'var(--text-primary)' }}>
            OpenAI
          </h2>
        </div>
        <p style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--color-warning-text)' }}>
          ~${estimatedSpend.toFixed(2)}
        </p>
      </div>

      <p className="mb-6" style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)' }}>
        Estimated based on {metrics.baselineModelAssumption || 'standard models'}
      </p>

      {/* Estimated Model Breakdown */}
      {pieData.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-4" style={{ fontSize: 'var(--text-heading)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Estimated Model Breakdown
          </h3>
          <ModelCostSharePie data={pieData} />
        </div>
      )}

      {/* Upgrade Nudge */}
      <TierUpgradeNudge sourceId="openai" currentTier="C" />

      {/* Optimization Tips */}
      <div
        className="rounded p-4 mb-6 border"
        style={{ background: 'var(--color-positive-muted)', borderColor: 'var(--color-positive)' }}
      >
        <p className="mb-3" style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--color-positive-text)' }}>
          Optimization Tips
        </p>
        <ul className="space-y-2" style={{ fontSize: 'var(--text-body)', color: 'var(--color-positive-text)' }}>
          <li>• Use smaller models for simple tasks to reduce costs</li>
          <li>• Consider batch processing for non-urgent requests</li>
          <li>• Monitor token usage patterns to identify optimization opportunities</li>
          <li>• Use temperature tuning for more efficient responses</li>
        </ul>
      </div>
    </div>
  );
}

