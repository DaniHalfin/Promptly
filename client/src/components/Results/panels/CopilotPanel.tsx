import React from 'react';
import { SourceReport } from '../../../types/index.js';
import { ModelCostSharePie } from '../charts/ModelCostSharePie.js';

interface CopilotPanelProps {
  report: SourceReport;
}

export function CopilotPanel({ report }: CopilotPanelProps) {
  const { metrics, tier } = report;

  if (!metrics) {
    return (
      <div className="border rounded-lg p-6 bg-slate-50">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-blue-600 rounded-full mr-3" />
          <h2 className="text-lg font-semibold">GitHub Copilot</h2>
          <span className="ml-2 px-2 py-1 bg-gray-200 text-gray-800 text-xs font-semibold rounded">{tier || 'N/A'}</span>
        </div>
        <p className="text-slate-600">No data available</p>
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
    .map(model => ({ model: model.model, costUsd: model.costUsd, percentage: model.costShare * 100 }))
    .filter(model => model.percentage > 0);

  return (
    <div className="border rounded-lg p-6 bg-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-blue-600 rounded-full mr-3" />
          <h2 className="text-lg font-semibold">GitHub Copilot</h2>
          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">Tier {tier}</span>
        </div>
      </div>

      <p className="text-sm text-slate-600 mb-6">
        Covers Chat, CLI, cloud agent, and Spaces. Code completions are unlimited and not billed here.
      </p>

      {/* 1: KPI tiles */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 rounded p-4">
          <p className="text-sm text-slate-600">Total Cost</p>
          <p className="text-2xl font-bold text-blue-600">${totalCost.toFixed(2)}</p>
        </div>
        <div className="bg-slate-50 rounded p-4">
          <p className="text-sm text-slate-600">Sessions</p>
          <p className="text-2xl font-bold text-slate-900">{sessionCount.toLocaleString()}</p>
        </div>
        <div className="bg-slate-50 rounded p-4">
          <p className="text-sm text-slate-600">Total Tokens</p>
          <p className="text-2xl font-bold text-slate-900">{(totalInputTokens + totalOutputTokens).toLocaleString()}</p>
        </div>
      </div>

      {/* 2: Token breakdown table (§7.16) */}
      {tokenBreakdown.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-4">Token breakdown by model</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="token-breakdown-table">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-semibold">Model</th>
                  <th className="text-right py-2 font-semibold">Input tokens</th>
                  <th className="text-right py-2 font-semibold">Output tokens</th>
                  <th className="text-right py-2 font-semibold">Cache read</th>
                  <th className="text-right py-2 font-semibold">Cache write</th>
                  <th className="text-right py-2 font-semibold">Reasoning</th>
                  <th className="text-right py-2 font-semibold">Requests</th>
                  <th className="text-right py-2 font-semibold">Cost (USD)</th>
                </tr>
              </thead>
              <tbody>
                {tokenBreakdown.map(row => (
                  <tr key={row.model} className="border-b hover:bg-slate-50">
                    <td className="py-2">{row.model}</td>
                    <td className="text-right">{row.inputTokens.toLocaleString()}</td>
                    <td className="text-right">{row.outputTokens.toLocaleString()}</td>
                    <td className="text-right">{row.cacheReadTokens.toLocaleString()}</td>
                    <td className="text-right">{row.cacheWriteTokens.toLocaleString()}</td>
                    <td className="text-right">{row.reasoningTokens.toLocaleString()}</td>
                    <td className="text-right">{row.requestCount.toLocaleString()}</td>
                    <td className="text-right">${row.requestCost.toFixed(4)}</td>
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
          <h3 className="text-sm font-semibold mb-4">Model spend</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-semibold">Model</th>
                  <th className="text-right py-2 font-semibold">Net spend</th>
                  <th className="text-right py-2 font-semibold">% of total</th>
                </tr>
              </thead>
              <tbody>
                {sortedModelCostBreakdown.map(model => (
                  <tr key={model.model} className="border-b hover:bg-slate-50">
                    <td className="py-2">{model.model}</td>
                    <td className="text-right">${model.costUsd.toFixed(2)}</td>
                    <td className="text-right">{(model.costShare * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4: Input / output token tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-50 rounded p-4">
          <p className="text-sm text-slate-600">Input tokens</p>
          <p className="text-2xl font-bold text-purple-600">{totalInputTokens.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">Total prompt tokens (cached reads/writes are subsets, not additive)</p>
        </div>
        <div className="bg-slate-50 rounded p-4">
          <p className="text-sm text-slate-600">Output tokens</p>
          <p className="text-2xl font-bold text-indigo-600">{totalOutputTokens.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">Total completion tokens (reasoning subsets included)</p>
        </div>
      </div>

      {/* 5: Cache-read fraction (§7.19) */}
      {cachedFraction && (
        <div className="mb-6">
          <div className="bg-slate-50 rounded p-4 mb-4" data-testid="cache-fraction-tile">
            <p className="text-sm text-slate-600">Cache-read fraction (aggregate)</p>
            <p className="text-2xl font-bold text-green-600">{(cachedFraction.aggregate * 100).toFixed(1)}%</p>
            <p className="text-xs text-slate-500 mt-1">Higher cache-read fraction = lower effective cost per token</p>
          </div>
          {cachedFraction.perModel.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Cache-read fraction by model</h3>
              <div className="space-y-2" data-testid="cache-fraction-bars">
                {cachedFraction.perModel.map(({ model, fraction }) => (
                  <div key={model}>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>{model}</span>
                      <span>{(fraction * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded overflow-hidden">
                      <div className="h-full bg-green-400 rounded" style={{ width: `${Math.min(fraction * 100, 100)}%` }} />
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
          <h3 className="text-sm font-semibold mb-4">Model cost share</h3>
          <ModelCostSharePie data={pieData} />
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <p className="text-sm font-semibold text-blue-900 mb-2">How to optimize Copilot AI credits</p>
        <p className="text-sm text-blue-800">Review high-share models above and prefer lower-cost models for routine tasks when quality is sufficient.</p>
      </div>
    </div>
  );
}
