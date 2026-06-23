import React from 'react';
import { SourceReport } from '../../../types/index.js';
import { ConversationLengthBar } from '../charts/ConversationLengthBar.js';
import { TierUpgradeNudge } from '../../common/TierUpgradeNudge.js';

interface FileExportPanelProps {
  report: SourceReport;
}

export function FileExportPanel({ report }: FileExportPanelProps) {
  const { metrics, tier, source_id } = report;

  const isAnthropic = source_id === 'claude_export';
  const displayName = isAnthropic ? 'Claude.ai (Export)' : 'ChatGPT (Export)';
  const gradientFrom = isAnthropic ? 'from-orange-400' : 'from-green-400';
  const gradientTo = isAnthropic ? 'to-red-600' : 'to-green-600';
  const textColor = isAnthropic ? 'text-orange-600' : 'text-green-600';

  if (!metrics) {
    return (
      <div className="border rounded-lg p-6 bg-slate-50">
        <div className="flex items-center mb-4">
          <div className={`w-8 h-8 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-full mr-3`} />
          <h2 className="text-lg font-semibold">{displayName}</h2>
          <span className="ml-2 px-2 py-1 bg-gray-200 text-gray-800 text-xs font-semibold rounded">
            {tier || 'N/A'}
          </span>
        </div>
        <p className="text-slate-600">No data available</p>
      </div>
    );
  }

  // Handle zero-data state
  if (!metrics.conversationCount && !metrics.estimatedTotalTokens) {
    return (
      <div className="border rounded-lg p-6 bg-slate-50">
        <div className="flex items-center mb-4">
          <div className={`w-8 h-8 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-full mr-3`} />
          <h2 className="text-lg font-semibold">{displayName}</h2>
          <span className="ml-2 px-2 py-1 bg-gray-200 text-gray-800 text-xs font-semibold rounded">
            {tier || 'N/A'}
          </span>
        </div>
        <p className="text-slate-600 text-center py-8">No conversations in this period</p>
      </div>
    );
  }

  const conversationCount = metrics.conversationCount || 0;
  const estimatedTokens = metrics.estimatedTotalTokens || 0;
  const avgLength = metrics.avgConversationLengthTokens || 0;
  const conversationHistogram = metrics.conversationLengthHistogram || [];
  const estimatedCost = metrics.estimatedRelativeCostUsd || 0;
  const assistantShare = metrics.assistantTokenShare || 0;
  const userShare = metrics.userTokenShare || 0;

  return (
    <div className="border rounded-lg p-6 bg-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className={`w-8 h-8 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-full mr-3`} />
          <h2 className="text-lg font-semibold">{displayName}</h2>
          <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
            Tier C
          </span>
        </div>
      </div>

      <p className="text-sm text-slate-600 mb-6">Estimated from {metrics.baselineModelAssumption || 'export file analysis'}</p>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-50 rounded p-4">
          <p className="text-sm text-slate-600">Conversations</p>
          <p className="text-2xl font-bold">{conversationCount.toLocaleString()}</p>
        </div>
        <div className="bg-slate-50 rounded p-4">
          <p className="text-sm text-slate-600">Total Tokens</p>
          <p className="text-2xl font-bold">{estimatedTokens.toLocaleString()}</p>
        </div>
        <div className="bg-slate-50 rounded p-4">
          <p className="text-sm text-slate-600">Avg Conversation Length</p>
          <p className="text-2xl font-bold">{avgLength.toLocaleString()}</p>
        </div>
        <div className="bg-slate-50 rounded p-4">
          <p className="text-sm text-slate-600">Estimated Cost</p>
          <p className={`text-2xl font-bold ${textColor}`}>~${estimatedCost.toFixed(2)}</p>
        </div>
      </div>

      {/* Token Distribution */}
      {(userShare > 0 || assistantShare > 0) && (
        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <h3 className="text-sm font-semibold text-indigo-900 mb-4">Token Distribution</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-indigo-800">Assistant Tokens</span>
                <span className="font-semibold text-indigo-900">{(assistantShare * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-indigo-200 rounded-full h-2">
                <div 
                  className="bg-indigo-600 h-2 rounded-full" 
                  style={{ width: `${assistantShare * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-indigo-800">User Tokens</span>
                <span className="font-semibold text-indigo-900">{(userShare * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-indigo-200 rounded-full h-2">
                <div 
                  className="bg-blue-400 h-2 rounded-full" 
                  style={{ width: `${userShare * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Distribution */}
      {conversationHistogram.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-4">Conversation Length Distribution</h3>
          <ConversationLengthBar data={conversationHistogram} />
        </div>
      )}

      {/* Long Conversation Indicator */}
      {metrics.longConversationFraction && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">{(metrics.longConversationFraction * 100).toFixed(1)}%</span> of conversations 
            are longer than 1000 tokens
          </p>
        </div>
      )}

      {/* Upgrade Nudge - Tier C only */}
      <TierUpgradeNudge sourceId={source_id} currentTier="C" />

      {/* Insights */}
      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-sm font-semibold text-green-900 mb-3">Quick Insights</p>
        <ul className="text-sm text-green-800 space-y-2">
          <li>
            • Average conversation: <span className="font-semibold">{avgLength.toLocaleString()} tokens</span>
          </li>
          {conversationCount > 100 && (
            <li>• High conversation volume—consider organizing by topic or use case</li>
          )}
          {assistantShare > 0.7 && (
            <li>• High assistant token ratio—model is being heavily utilized</li>
          )}
          {estimatedCost > 10 && (
            <li>• Significant estimated cost—API connection could provide cost optimization insights</li>
          )}
        </ul>
      </div>
    </div>
  );
}
