import React from 'react';
import { formatTokenCount } from '../../../lib/formatters.js';
import { SourceReport } from '../../../types/index.js';
import { ConversationLengthBar } from '../charts/ConversationLengthBar.js';
import { TierUpgradeNudge } from '../../common/TierUpgradeNudge.js';

interface FileExportPanelProps {
  report: SourceReport;
}

export function FileExportPanel({ report }: FileExportPanelProps) {
  const { metrics, tier, source_id } = report;

  const isAnthropic   = source_id === 'claude_export';
  const displayName   = isAnthropic ? 'Claude.ai (Export)' : 'ChatGPT (Export)';
  const gradientFrom  = isAnthropic ? 'from-orange-400' : 'from-green-400';
  const gradientTo    = isAnthropic ? 'to-red-600'      : 'to-green-600';
  // Computed CSS-variable color for the estimated cost figure
  const accentColor   = isAnthropic ? 'var(--color-warning-text)' : 'var(--color-positive-text)';

  // ── Empty / no-metrics state ─────────────────────────────────────────────
  if (!metrics) {
    return (
      <div className="border rounded-lg p-6" style={{ background: 'var(--color-bg-surface)' }}>
        <div className="flex items-center mb-4">
          <div className={`w-8 h-8 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-full mr-3`} />
          <h2 style={{ fontSize: 'var(--text-title)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {displayName}
          </h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body)' }}>No data available</p>
      </div>
    );
  }

  // ── Zero-data state ──────────────────────────────────────────────────────
  if (!metrics.conversationCount && !metrics.estimatedTotalTokens) {
    return (
      <div className="border rounded-lg p-6" style={{ background: 'var(--color-bg-surface)' }}>
        <div className="flex items-center mb-4">
          <div className={`w-8 h-8 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-full mr-3`} />
          <h2 style={{ fontSize: 'var(--text-title)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {displayName}
          </h2>
        </div>
        <p
          className="text-center py-8"
          style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body)' }}
        >
          No conversations in this period
        </p>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────
  const conversationCount      = metrics.conversationCount || 0;
  const estimatedTokens        = metrics.estimatedTotalTokens || 0;
  const avgLength              = metrics.avgConversationLengthTokens || 0;
  const conversationHistogram  = metrics.conversationLengthHistogram || [];
  const estimatedCost          = metrics.estimatedRelativeCostUsd || 0;
  const assistantShare         = metrics.assistantTokenShare || 0;
  const userShare              = metrics.userTokenShare || 0;

  return (
    <div className="border rounded-lg p-6" style={{ background: 'var(--color-bg-surface)' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className={`w-8 h-8 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-full mr-3`} />
          <h2 style={{ fontSize: 'var(--text-title)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {displayName}
          </h2>
        </div>
      </div>

      <p className="mb-6" style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)' }}>
        Estimated from {metrics.baselineModelAssumption || 'export file analysis'}
      </p>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded p-4" style={{ background: 'var(--color-bg-inset)' }}>
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)' }}>Conversations</p>
          <p style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {conversationCount.toLocaleString()}
          </p>
        </div>
        <div className="rounded p-4" style={{ background: 'var(--color-bg-inset)' }}>
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)' }}>Total Tokens</p>
          <p style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatTokenCount(estimatedTokens)}
          </p>
        </div>
        <div className="rounded p-4" style={{ background: 'var(--color-bg-inset)' }}>
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)' }}>Avg Conversation Length</p>
          <p style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatTokenCount(avgLength)}
          </p>
        </div>
        <div className="rounded p-4" style={{ background: 'var(--color-bg-inset)' }}>
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)' }}>Estimated Cost</p>
          <p style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: accentColor }}>
            ~${estimatedCost.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Token Distribution */}
      {(userShare > 0 || assistantShare > 0) && (
        <div
          className="mb-6 p-4 rounded-lg border"
          style={{ background: 'var(--color-accent-muted)', borderColor: 'var(--color-accent-border)' }}
        >
          <h3 className="mb-4" style={{ fontSize: 'var(--text-heading)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Token Distribution
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-2" style={{ fontSize: 'var(--text-body)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Assistant Tokens</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {(assistantShare * 100).toFixed(1)}%
                </span>
              </div>
              <div
                className="w-full rounded-full h-2"
                style={{ background: 'var(--color-accent-border)' }}
              >
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${assistantShare * 100}%`, background: 'var(--color-accent)' }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2" style={{ fontSize: 'var(--text-body)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>User Tokens</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {(userShare * 100).toFixed(1)}%
                </span>
              </div>
              <div
                className="w-full rounded-full h-2"
                style={{ background: 'var(--color-accent-border)' }}
              >
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${userShare * 100}%`, background: 'var(--color-info)' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Distribution */}
      {conversationHistogram.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-4" style={{ fontSize: 'var(--text-heading)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Conversation Length Distribution
          </h3>
          <ConversationLengthBar data={conversationHistogram} />
        </div>
      )}

      {/* Long Conversation Indicator */}
      {metrics.longConversationFraction && (
        <div
          className="mb-6 p-4 rounded-lg border"
          style={{ background: 'var(--color-bg-inset)', borderColor: 'var(--color-accent-border)' }}
        >
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {(metrics.longConversationFraction * 100).toFixed(1)}%
            </span>{' '}
            of conversations are longer than 1000 tokens
          </p>
        </div>
      )}

      {/* Upgrade Nudge — Tier C only */}
      <TierUpgradeNudge sourceId={source_id} currentTier="C" />

      {/* Insights */}
      <div
        className="mt-6 p-4 rounded-lg border"
        style={{ background: 'var(--color-positive-muted)', borderColor: 'var(--color-positive)' }}
      >
        <p className="mb-3" style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--color-positive-text)' }}>
          Quick Insights
        </p>
        <ul className="space-y-2" style={{ fontSize: 'var(--text-body)', color: 'var(--color-positive-text)' }}>
          <li>
            • Average conversation:{' '}
            <span style={{ fontWeight: 600 }}>{formatTokenCount(avgLength)} tokens</span>
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

