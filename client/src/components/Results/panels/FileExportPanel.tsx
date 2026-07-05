import React from 'react';
import { SourceReport } from '../../../types/index.js';
import { DailyConversationActivityLine } from '../DailyConversationActivityLine.js';
import { TierUpgradeNudge } from '../../common/TierUpgradeNudge.js';

interface FileExportPanelProps {
  report: SourceReport;
}

export function FileExportPanel({ report }: FileExportPanelProps) {
  const { metrics, source_id } = report;

  const isAnthropic   = source_id === 'claude_export';
  const displayName   = isAnthropic ? 'Claude.ai (Export)' : 'ChatGPT (Export)';
  const accentColor   = isAnthropic ? 'var(--color-warning-text)' : 'var(--color-positive-text)';

  // Empty / no-metrics state
  if (!metrics) {
    return (
      <div className="card">
        <h2 style={{ fontSize: 'var(--text-title)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          {displayName}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body)', margin: 0 }}>No data available</p>
      </div>
    );
  }

  // Canonical Tier C fields
  const totalConversations  = metrics.total_conversations ?? 0;
  const totalMessages       = metrics.total_messages ?? 0;
  const activeDays          = metrics.active_days ?? 0;
  const modelsIdentified    = metrics.models_identified ?? [];
  const estimatedCost       = metrics.estimated_relative_cost_usd ?? 0;
  const dailyActivity       = metrics.daily_conversation_activity ?? [];
  const estimatedTokenVol   = metrics.estimated_token_volume ?? 0;
  // Average conversation length is DERIVED: not a stored field
  const avgConvLength       = totalConversations > 0 ? Math.round(totalMessages / totalConversations) : 0;

  // Zero-data state
  if (totalConversations === 0 && estimatedTokenVol === 0) {
    return (
      <div className="card">
        <h2 style={{ fontSize: 'var(--text-title)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          {displayName}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body)', margin: 0 }}>
          No conversations found in this period
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 'var(--text-title)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          {displayName}
        </h2>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Tier C · Estimated from conversation activity
        </p>
      </div>

      {/* Canonical Tier C metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>

        <div style={{ background: 'var(--color-bg-inset)', padding: '12px 14px', borderRadius: 'var(--radius-md)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}>Total Conversations</p>
          <p style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {totalConversations.toLocaleString()}
          </p>
        </div>

        <div style={{ background: 'var(--color-bg-inset)', padding: '12px 14px', borderRadius: 'var(--radius-md)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}>Total Messages</p>
          <p style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {totalMessages.toLocaleString()}
          </p>
        </div>

        <div style={{ background: 'var(--color-bg-inset)', padding: '12px 14px', borderRadius: 'var(--radius-md)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}>Active Days</p>
          <p style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {activeDays}
          </p>
        </div>

        <div style={{ background: 'var(--color-bg-inset)', padding: '12px 14px', borderRadius: 'var(--radius-md)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}>Avg Messages / Conversation</p>
          <p style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {avgConvLength}
          </p>
        </div>

        {/* Estimated cost: always labeled with ~ and "estimated" */}
        <div style={{ background: 'var(--color-bg-inset)', padding: '12px 14px', borderRadius: 'var(--radius-md)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}>
            Estimated Cost <span style={{ color: 'var(--color-warning-text)' }}>(estimated)</span>
          </p>
          <p style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: accentColor, margin: 0 }}>
            ~${estimatedCost.toFixed(2)}
          </p>
        </div>

        {/* Estimated token volume: always labeled */}
        <div style={{ background: 'var(--color-bg-inset)', padding: '12px 14px', borderRadius: 'var(--radius-md)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}>
            Token Volume <span style={{ color: 'var(--color-warning-text)' }}>(estimated)</span>
          </p>
          <p style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            ~{estimatedTokenVol.toLocaleString()}
          </p>
        </div>

      </div>

      {/* Models identified */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          Models Identified
        </p>
        {modelsIdentified.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {modelsIdentified.map(m => (
              <span key={m} style={{ fontSize: '0.8125rem', padding: '2px 10px', background: 'var(--color-bg-inset)', borderRadius: 'var(--radius-pill)', color: 'var(--text-secondary)' }}>
                {m}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Model data not available in export
          </p>
        )}
      </div>

      {/* Daily conversation activity sparkline */}
      {dailyActivity.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Daily Activity
          </p>
          <DailyConversationActivityLine data={dailyActivity} />
        </div>
      )}

      {/* Unavailable rows for actual billing fields */}
      <div style={{ background: 'var(--color-bg-inset)', padding: '12px 14px', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Actual billing spend, session cost, cache savings, and dominant model are not available from export data.
        </p>
      </div>

      {/* Upgrade Nudge — Tier C only */}
      <TierUpgradeNudge sourceId={source_id} currentTier="C" />
    </div>
  );
}
