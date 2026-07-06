import React from 'react';
import type { RecommendationResult, SourceReport, SpendByToolEntry } from '../../types/index.js';
import { DailyConversationActivityLine } from './DailyConversationActivityLine.js';
import { EfficiencySignalCallout } from './EfficiencySignalCallout.js';
import { ModelSpendMiniBar } from './ModelSpendMiniBar.js';

interface ToolSpendCardProps {
  source: SourceReport;
  recommendations: RecommendationResult[];
  spendEntry?: SpendByToolEntry;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
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

const fmtUsd = (n: number) => `$${n.toFixed(2)}`;
const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');

/** Minimal accessible spend trend surface for Tier B sources that emit dailySpend. */
function MiniSpendTrend({ sourceId, data }: { sourceId: string; data: Array<{ date: string; spendUsd: number }> }) {
  return (
    <figure
      data-testid={`spend-trend-${sourceId}`}
      aria-label="Daily spend trend"
      style={{ margin: 0 }}
    >
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr><th scope="col">Date</th><th scope="col">Spend (USD)</th></tr>
          </thead>
          <tbody>
            {data.map(d => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td>${d.spendUsd.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 32 }}>
        {(() => {
          const peak = data.reduce((m, d) => Math.max(m, d.spendUsd), 0) || 1;
          return data.map(d => (
            <div
              key={d.date}
              title={`${d.date}: ${fmtUsd(d.spendUsd)}`}
              style={{
                flex: 1,
                minWidth: 2,
                height: `${Math.max(2, (d.spendUsd / peak) * 32)}px`,
                background: 'var(--color-accent)',
                borderRadius: 1,
              }}
            />
          ));
        })()}
      </div>
    </figure>
  );
}

export function ToolSpendCard({ source, recommendations, spendEntry, expanded = true, onExpandedChange }: ToolSpendCardProps) {
  const { source_id, tier, metrics, error } = source;
  const displayName = SOURCE_DISPLAY_NAMES[source_id] ?? source_id;
  const isTierC = source_id === 'chatgpt_export' || source_id === 'claude_export';
  const isCopilot = source_id === 'github_copilot';
  const m = (metrics as any) ?? {};

  // Derive spend display (canonical — no estimated/actual distinction shown)
  const spend = spendEntry?.estimated_spend_usd
    ?? m.totalSpendUsd
    ?? m.totalActualSpendUsd
    ?? m.copilotTotalCostUsd
    ?? m.estimated_relative_cost_usd;

  // Models: models_identified → modelBreakdown → copilotModelCostBreakdown fallback
  const modelsIdentified: string[] = m.models_identified?.length
    ? m.models_identified
    : m.modelBreakdown?.length
      ? m.modelBreakdown.map((e: any) => e.model)
      : m.copilotModelCostBreakdown?.length
        ? m.copilotModelCostBreakdown.map((e: any) => e.model)
        : [];

  const dailyActivity = m.daily_conversation_activity ?? [];
  const dailySpend: Array<{ date: string; spendUsd: number }> = m.dailySpend ?? [];

  // Source-specific key metrics — factual, no calculation caveats.
  const keyMetrics: Array<{ label: string; value: string }> = [];
  if (isCopilot) {
    if (m.copilotSessionCount != null) keyMetrics.push({ label: 'Sessions', value: fmtInt(m.copilotSessionCount) });
    if (m.totalActualTokens != null) keyMetrics.push({ label: 'Total tokens', value: fmtInt(m.totalActualTokens) });
    if (m.copilotAvgTokensPerSession != null) keyMetrics.push({ label: 'Avg tokens/session', value: fmtInt(m.copilotAvgTokensPerSession) });
  } else if (isTierC) {
    if (m.total_conversations != null) keyMetrics.push({ label: 'Conversations', value: fmtInt(m.total_conversations) });
    if (m.total_messages != null) keyMetrics.push({ label: 'Messages', value: fmtInt(m.total_messages) });
    if (m.active_days != null) keyMetrics.push({ label: 'Active days', value: fmtInt(m.active_days) });
    if (m.estimated_token_volume != null) keyMetrics.push({ label: 'Token volume', value: fmtInt(m.estimated_token_volume) });
  } else {
    // OpenAI / Anthropic / Claude Code
    if (m.totalActualTokens != null) keyMetrics.push({ label: 'Total tokens', value: fmtInt(m.totalActualTokens) });
    if (m.avgDailySpendUsd != null) keyMetrics.push({ label: 'Avg daily spend', value: fmtUsd(m.avgDailySpendUsd) });
    const cacheSavings = m.cachedTokenSavingsUsdAnthropic ?? m.cachedTokenSavingsUsdClaudeCode;
    if (cacheSavings != null && cacheSavings > 0) keyMetrics.push({ label: 'Cache savings', value: fmtUsd(cacheSavings) });
  }

  return (
    <div
      id={`tool-card-${source_id}`}
      data-testid={`tool-spend-card-${source_id}`}
      tabIndex={-1}
      className="card"
      style={{ marginBottom: 16, borderLeft: '4px solid var(--color-accent)' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={`tool-panel-${source_id}`}
            onClick={() => onExpandedChange?.(!expanded)}
            style={{
              minHeight: 44,
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: onExpandedChange ? 'pointer' : 'default',
              font: 'inherit',
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'block', margin: '0 0 2px', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {displayName}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {expanded ? 'Collapse details' : 'Expand details'}
            </span>
          </button>
        </div>
        {spend != null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {fmtUsd(spend)}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Spend</div>
          </div>
        )}
      </div>

      <div id={`tool-panel-${source_id}`} hidden={!expanded}>

      {/* Error state */}
      {error && (
        <p style={{ color: 'var(--color-critical-text)', fontSize: '0.875rem', margin: '8px 0' }}>
          Error: {error}
        </p>
      )}

      {/* Key metrics */}
      {keyMetrics.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
          {keyMetrics.map(km => (
            <div key={km.label}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {km.label}
              </div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {km.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isTierC && <EfficiencySignalCallout signal={m.efficiencySignal} />}

      {!isTierC && <ModelSpendMiniBar source={source} />}

      {/* Tier C Models */}
      {isTierC && modelsIdentified.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Models</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {modelsIdentified.map((mdl: string) => (
              <span key={mdl} style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'var(--color-bg-inset)', borderRadius: 'var(--radius-pill)', color: 'var(--text-secondary)' }}>
                {mdl}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Trend sparkline: Tier C conversation activity, or Tier B daily spend */}
      {isTierC && dailyActivity.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Daily Activity</div>
          <DailyConversationActivityLine data={dailyActivity} />
        </div>
      )}
      {!isTierC && dailySpend.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Daily Spend</div>
          <MiniSpendTrend sourceId={source_id} data={dailySpend} />
        </div>
      )}

      {/* Source-scoped recommendations */}
      {recommendations.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border-subtle)', paddingTop: 12 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Recommendations
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recommendations.map(rec => (
              <div
                key={rec.id}
                id={`rec-${source_id}-${rec.id}`}
                tabIndex={-1}
                className="rec-focus-target"
                style={{ borderLeft: `3px solid ${recBorderColor(rec)}`, paddingLeft: 10 }}
              >
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {rec.title}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                  {rec.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
