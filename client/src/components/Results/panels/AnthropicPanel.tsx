import React from 'react';
import { SourceReport } from '../../../types/index.js';
import { DailySpendLine } from '../charts/DailySpendLine.js';
import { ModelCostSharePie } from '../charts/ModelCostSharePie.js';
import { TokenRatioBar } from '../charts/TokenRatioBar.js';
import { TierUpgradeNudge } from '../../common/TierUpgradeNudge.js';

interface AnthropicPanelProps {
  report: SourceReport;
}

export function AnthropicPanel({ report }: AnthropicPanelProps) {
  const { metrics, tier } = report;

  if (!metrics) {
    return (
      <div className="border rounded-lg p-6 bg-slate-50">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-600 rounded-full mr-3" />
          <h2 className="text-lg font-semibold">Anthropic</h2>
          <span className="ml-2 px-2 py-1 bg-gray-200 text-gray-800 text-xs font-semibold rounded">
            {tier || 'N/A'}
          </span>
        </div>
        <p className="text-slate-600">No data available</p>
      </div>
    );
  }

  // Handle zero-data state
  if (!metrics.totalActualSpendUsd && !metrics.modelBreakdown?.length) {
    return (
      <div className="border rounded-lg p-6 bg-slate-50">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-600 rounded-full mr-3" />
          <h2 className="text-lg font-semibold">Anthropic</h2>
          <span className="ml-2 px-2 py-1 bg-gray-200 text-gray-800 text-xs font-semibold rounded">
            {tier || 'N/A'}
          </span>
        </div>
        <p className="text-slate-600 text-center py-8">$0.00 — No activity in this period</p>
      </div>
    );
  }

  // Tier B and higher metrics
  if (tier === 'A' || tier === 'B') {
    const totalSpend = metrics.totalActualSpendUsd || 0;
    const modelBreakdown = metrics.modelBreakdown || [];
    const pieData = modelBreakdown.map(m => ({
      model: m.model,
      costUsd: m.estimatedCostUsd,
      percentage: totalSpend > 0 ? (m.estimatedCostUsd / totalSpend) * 100 : 0,
    }));

    const dailySpendData = (metrics.dailySpend || []).map(d => ({
      date: d.date,
      costUsd: d.spendUsd,
    }));

    // Aggregate token counts from model breakdown
    const totalInputTokens = modelBreakdown.reduce((sum, m) => sum + m.inputTokens, 0);
    const totalOutputTokens = modelBreakdown.reduce((sum, m) => sum + m.outputTokens, 0);
    const totalCachedTokens = modelBreakdown.reduce((sum, m) => sum + (m.cachedInputTokens || 0), 0);

    const topRecommendation = 'Leverage prompt caching to reduce costs on repeated queries';

    return (
      <div className="border rounded-lg p-6 bg-white">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-600 rounded-full mr-3" />
            <h2 className="text-lg font-semibold">Anthropic</h2>
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
              Tier {tier}
            </span>
          </div>
          <p className="text-3xl font-bold text-orange-600">${totalSpend.toFixed(2)}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-50 rounded p-4">
            <p className="text-sm text-slate-600">Avg Daily Spend</p>
            <p className="text-xl font-semibold">${(metrics.avgDailySpendUsd || 0).toFixed(2)}</p>
          </div>
          <div className="bg-slate-50 rounded p-4">
            <p className="text-sm text-slate-600">Peak Day</p>
            {metrics.peakSpendDay ? (
              <p className="text-xl font-semibold">${metrics.peakSpendDay.spendUsd.toFixed(2)}</p>
            ) : (
              <p className="text-xl font-semibold">—</p>
            )}
          </div>
        </div>

        {/* Daily Spend Chart */}
        {dailySpendData.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-4">Daily Spend Trend</h3>
            <DailySpendLine data={dailySpendData} />
          </div>
        )}

        {/* Model Breakdown */}
        {modelBreakdown.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-4">Model Breakdown</h3>
            <div className="grid grid-cols-2 gap-6">
              {pieData.length > 0 && (
                <div>
                  <ModelCostSharePie data={pieData} />
                </div>
              )}
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
                    {modelBreakdown.map((m, idx) => (
                      <tr key={idx} className="border-b hover:bg-slate-50">
                        <td className="py-2">{m.model}</td>
                        <td className="text-right">${m.estimatedCostUsd.toFixed(2)}</td>
                        <td className="text-right">
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

        {/* Token Ratio with Cache Info */}
        {(totalInputTokens > 0 || totalOutputTokens > 0) && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-4">Token Distribution</h3>
            <TokenRatioBar
              inputTokens={totalInputTokens}
              outputTokens={totalOutputTokens}
              cachedTokens={totalCachedTokens > 0 ? totalCachedTokens : undefined}
            />
            {metrics.cachedTokenFractionAnthropic !== undefined &&
              metrics.cachedTokenSavingsUsdAnthropic &&
              metrics.cachedTokenSavingsUsdAnthropic > 0 && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-sm">
                <p className="text-green-900">
                  <span className="font-semibold">Prompt Cache Savings:</span> ${metrics.cachedTokenSavingsUsdAnthropic.toFixed(2)}
                  ({((metrics.cachedTokenFractionAnthropic || 0) * 100).toFixed(1)}% of tokens)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Top Recommendation */}
        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <p className="text-sm font-semibold text-blue-900">Recommendation</p>
          <p className="text-sm text-blue-800 mt-1">{topRecommendation}</p>
        </div>
      </div>
    );
  }

  // Tier C metrics
  const estimatedSpend = metrics.estimatedRelativeCostUsd || 0;
  const modelBreakdown = metrics.modelBreakdown || [];
  const pieData = modelBreakdown
    .filter(m => m.estimatedCostUsd > 0)
    .map(m => ({
      model: m.model,
      costUsd: m.estimatedCostUsd,
      percentage: estimatedSpend > 0 ? (m.estimatedCostUsd / estimatedSpend) * 100 : 0,
    }));

  return (
    <div className="border rounded-lg p-6 bg-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-600 rounded-full mr-3" />
          <h2 className="text-lg font-semibold">Anthropic</h2>
          <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
            Tier C
          </span>
        </div>
        <p className="text-3xl font-bold text-orange-600">~${estimatedSpend.toFixed(2)}</p>
      </div>

      <p className="text-sm text-slate-600 mb-6">Estimated based on {metrics.baselineModelAssumption || 'standard models'}</p>

      {/* Model Comparison */}
      {pieData.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-4">Estimated Model Breakdown</h3>
          <ModelCostSharePie data={pieData} />
        </div>
      )}

      {/* Upgrade Nudge */}
      <TierUpgradeNudge sourceId="anthropic" currentTier="C" />

      {/* Optimization Tips */}
      <div className="bg-green-50 border border-green-200 rounded p-4 mb-6">
        <p className="text-sm font-semibold text-green-900 mb-3">Optimization Tips</p>
        <ul className="text-sm text-green-800 space-y-2">
          <li>• Use Claude's prompt caching to reduce costs on repeated content</li>
          <li>• Consider batch processing for non-urgent requests</li>
          <li>• Use smaller models (Haiku) for simple classification tasks</li>
          <li>• Leverage vision capabilities efficiently</li>
        </ul>
      </div>
    </div>
  );
}
