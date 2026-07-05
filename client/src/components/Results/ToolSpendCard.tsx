import React from 'react';
import type { RecommendationResult, SourceReport, SpendByToolEntry } from '../../types/index.js';
import { DailyConversationActivityLine } from './DailyConversationActivityLine.js';

interface ToolSpendCardProps {
  source: SourceReport;
  recommendations: RecommendationResult[];
  spendEntry?: SpendByToolEntry;
}

const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  github_copilot: 'GitHub Copilot',
  claude_code: 'Claude Code',
  chatgpt_export: 'ChatGPT Export',
  claude_export: 'Claude.ai Export',
};

const recBorderColor = (rec: RecommendationResult) => {
  if (rec.severity === 'High') return 'var(--color-critical)';
  if (rec.severity === 'Medium') return 'var(--color-warning)';
  return 'var(--color-info)';
};

export function ToolSpendCard({ source, recommendations, spendEntry }: ToolSpendCardProps) {
  const { source_id, tier, metrics, error } = source;
  const displayName = SOURCE_DISPLAY_NAMES[source_id] ?? source_id;
  const isTierC = source_id === 'chatgpt_export' || source_id === 'claude_export';

  // Derive spend display
  const spend = spendEntry?.estimated_spend_usd
    ?? (metrics as any)?.totalSpendUsd
    ?? (metrics as any)?.totalActualSpendUsd
    ?? (metrics as any)?.copilotTotalCostUsd
    ?? (metrics as any)?.estimated_relative_cost_usd;
  const isEstimated = spendEntry?.is_estimated ?? isTierC;

  const dailyActivity = (metrics as any)?.daily_conversation_activity ?? [];
  const modelsIdentified: string[] = (metrics as any)?.models_identified ?? [];

  return (
    <div
      data-testid={`tool-spend-card-${source_id}`}
      className="card"
      style={{ marginBottom: 16, borderLeft: '4px solid var(--color-accent)' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: '0 0 2px', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {displayName}
          </h3>
          {tier && (
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Tier {tier}
            </span>
          )}
        </div>
        {spend != null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {isEstimated ? '~' : ''}${spend.toFixed(2)}
            </div>
            {isEstimated && (
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-warning-text)' }}>estimated</div>
            )}
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <p style={{ color: 'var(--color-critical-text)', fontSize: '0.875rem', margin: '8px 0' }}>
          Error: {error}
        </p>
      )}

      {/* Models */}
      {modelsIdentified.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Models</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {modelsIdentified.map(m => (
              <span key={m} style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'var(--color-bg-inset)', borderRadius: 'var(--radius-pill)', color: 'var(--text-secondary)' }}>
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Daily conversation activity sparkline — Tier C only */}
      {isTierC && dailyActivity.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Daily Activity</div>
          <DailyConversationActivityLine data={dailyActivity} />
        </div>
      )}

      {/* Source-scoped recommendations */}
      {recommendations.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Recommendations
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recommendations.map(rec => (
              <div key={rec.id} style={{ borderLeft: `3px solid ${recBorderColor(rec)}`, paddingLeft: 10 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {rec.title}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {rec.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
