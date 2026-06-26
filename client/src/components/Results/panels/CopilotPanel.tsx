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
          <span className="ml-2 px-2 py-1 bg-gray-200 text-gray-800 text-xs font-semibold rounded">
            {tier || 'N/A'}
          </span>
        </div>
        <p className="text-slate-600">No data available</p>
      </div>
    );
  }

  const netSpend = metrics.copilotNetSpendUsd ?? 0;
  const sessionCount = metrics.copilotSessionCount ?? 0;
  const totalInputTokens = metrics.copilotTotalInputTokens ?? 0;
  const totalOutputTokens = metrics.copilotTotalOutputTokens ?? 0;
  const spendByModel = metrics.copilotSpendByModel ?? [];
  const sortedSpendByModel = [...spendByModel].sort((a, b) => b.netSpendUsd - a.netSpendUsd);
  const distributionByModel = new Map((metrics.copilotModelDistribution ?? []).map(model => [model.model, model.share]));
  const pieData = (metrics.copilotModelDistribution ?? [])
    .map(model => ({
      model: model.model,
      costUsd: netSpend * model.share,
      percentage: model.share * 100,
    }))
    .filter(model => model.percentage > 0);

  return (
    <div className="border rounded-lg p-6 bg-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-blue-600 rounded-full mr-3" />
          <h2 className="text-lg font-semibold">GitHub Copilot</h2>
          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
            Tier {tier}
          </span>
        </div>
      </div>

      <p className="text-sm text-slate-600 mb-6">
        Covers Chat, CLI, cloud agent, and Spaces. Code completions are unlimited and not billed here.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 rounded p-4">
          <p className="text-sm text-slate-600">Net Spend</p>
          <p className="text-2xl font-bold text-blue-600">${netSpend.toFixed(2)}</p>
        </div>
        <div className="bg-slate-50 rounded p-4">
          <p className="text-sm text-slate-600">Sessions</p>
          <p className="text-2xl font-bold text-slate-900">{sessionCount.toLocaleString()}</p>
        </div>
        <div className="bg-slate-50 rounded p-4">
          <p className="text-sm text-slate-600">Total Tokens</p>
          <p className="text-2xl font-bold text-slate-900">
            {(totalInputTokens + totalOutputTokens).toLocaleString()}
          </p>
        </div>
      </div>

      {spendByModel.length > 0 && (
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
                {sortedSpendByModel.map(model => {
                  const share = distributionByModel.get(model.model) ?? model.spendShare;

                  return (
                  <tr key={model.model} className="border-b hover:bg-slate-50">
                    <td className="py-2">{model.model}</td>
                    <td className="text-right">${model.netSpendUsd.toFixed(2)}</td>
                    <td className="text-right">{(share * 100).toFixed(1)}%</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {pieData.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-4">Model cost share</h3>
          <ModelCostSharePie data={pieData} />
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <p className="text-sm font-semibold text-blue-900 mb-2">How to optimize Copilot AI credits</p>
        <p className="text-sm text-blue-800">
          Review high-share models above and prefer lower-cost models for routine tasks when quality is sufficient.
        </p>
      </div>
    </div>
  );
}
