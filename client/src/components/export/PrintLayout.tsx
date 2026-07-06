import React from 'react';
import type { AnalysisReport, SourceReport, SpendByToolEntry } from '../../types/index.js';
import { friendlySourceName } from '../../lib/modelNames.js';
import { EfficiencySignalCallout } from '../Results/EfficiencySignalCallout.js';
import { getModelSpendRows } from '../Results/ModelSpendMiniBar.js';

interface PrintLayoutProps {
  report: AnalysisReport;
}

/** ADR-9 narrative print layout. No interactive elements — print-safe only. */
export function PrintLayout({ report }: PrintLayoutProps) {
  const css   = report.cross_source_summary;
  const meta  = report.metadata;

  const totalSpend    = (css.total_estimated_spend_usd ?? 0) > 0 ? css.total_estimated_spend_usd : css.total_actual_spend_usd;
  const spendLabel: 'Spend' | 'Estimated spend' = css.includes_estimates === true ? 'Estimated spend' : 'Spend';
  const sourceCount   = report.sources.filter(s => !s.error).length;
  // Parse a date-only string (YYYY-MM-DD) as local noon to avoid UTC-to-local off-by-one.
  const parseDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00`) : new Date(d);
  const generatedDate = parseDate(meta.generated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const periodStart   = meta.analysis_period_start
    ? parseDate(meta.analysis_period_start).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';
  const periodEnd     = meta.analysis_period_end
    ? parseDate(meta.analysis_period_end).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

  const spendByTool   = css.spend_by_tool ?? [];
  const dailySpend    = css.daily_spend ?? [];

  // Sort sources by spend_by_tool rank
  const rankMap = new Map(spendByTool.map(e => [e.source_id as string, e.rank]));
  const sortedSources = [...report.sources].sort((a, b) => (rankMap.get(a.source_id) ?? 999) - (rankMap.get(b.source_id) ?? 999));

  const root: React.CSSProperties = {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    lineHeight: 1.5,
    color: '#1f2937',
    backgroundColor: '#ffffff',
    padding: '40px',
    width: '210mm',
    minHeight: '297mm',
    boxSizing: 'border-box',
  };

  const sectionHead: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    color: '#111827',
    borderBottom: '1.5px solid #e5e7eb',
    paddingBottom: 8,
    marginBottom: 16,
    marginTop: 32,
  };

  const cell: React.CSSProperties = {
    background: '#f9fafb',
    padding: '12px 16px',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
  };

  const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' };
  const value: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 };

  // ── § 1  AnalysisHeader ────────────────────────────────────────────────
  const AnalysisHeader = () => {
    const totalPotentialSavings = css.total_potential_savings_usd ?? 0;
    const actionableCount = css.actionable_recommendation_count ?? 0;
    const showPotentialSavings = totalPotentialSavings > 0 && actionableCount > 0;

    return (
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: '#0066cc', marginBottom: 4 }}>
          ${(totalSpend ?? 0).toFixed(2)}
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {spendLabel} · {sourceCount} {sourceCount === 1 ? 'source' : 'sources'} · {periodStart} – {periodEnd}
        </p>
        {showPotentialSavings && (
          <div style={{ display: 'inline-block', marginTop: 16, padding: '10px 16px', border: '1px solid #16a34a', borderRadius: 8, textAlign: 'left', maxWidth: 520 }}>
            <p style={{ ...label, color: '#16a34a' }}>Total Potential Savings</p>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#111827', margin: 0 }}>
              Save up to <strong style={{ color: '#16a34a' }}>${totalPotentialSavings.toFixed(2)}</strong> across {actionableCount} {actionableCount === 1 ? 'recommendation' : 'recommendations'}
            </p>
          </div>
        )}
      </div>
    );
  };

  // ── § 2  MoneyByToolSection ────────────────────────────────────────────
  const MoneyByToolSection = () => {
    if (spendByTool.length === 0) return null;
    const maxSpend = Math.max(...spendByTool.map(e => e.estimated_spend_usd ?? 0), 0.01);
    return (
      <div>
        <h2 style={sectionHead}>Spend by Tool</h2>
        {spendByTool.map(e => (
          <div key={e.source_id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 140, fontSize: 13, color: '#374151', flexShrink: 0 }}>{friendlySourceName(e.source_id)}</div>
            <div style={{ flex: 1, height: 16, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                background: '#0066cc',
                width: `${((e.estimated_spend_usd ?? 0) / maxSpend) * 100}%`,
                borderRadius: 4,
              }} />
            </div>
            <div style={{ width: 80, textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#111827', flexShrink: 0 }}>
              ${(e.estimated_spend_usd ?? 0).toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── § 3  SpendingTrendSection ──────────────────────────────────────────
  const SpendingTrendSection = () => {
    if (dailySpend.length === 0) return null;
    return (
      <div>
        <h2 style={sectionHead}>Daily Spend Trend</h2>
        {css.spike_callout && (
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 6, padding: '10px 14px', marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>
              ⚠ Spend spike detected: {css.spike_callout.date} — ${(css.spike_callout.spend_usd ?? 0).toFixed(2)}
              {css.spike_callout.message ? ` · ${css.spike_callout.message}` : ''}
            </p>
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Date</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Spend</th>
            </tr>
          </thead>
          <tbody>
            {dailySpend.map(row => (
              <tr key={row.date} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '5px 8px', color: '#374151' }}>{row.date}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>${(row.spend_usd ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ── § 4  Per-source cards ──────────────────────────────────────────────
  const SourceCard = ({ source }: { source: SourceReport }) => {
    const m    = source.metrics;
    const name = friendlySourceName(source.source_id);
    const spend = spendByTool.find(e => e.source_id === source.source_id);
    const isTierC = source.tier === 'C';
    const modelSpendRows = getModelSpendRows(source);

    if (source.error) {
      return (
        <div style={{ border: '1px solid #fca5a5', background: '#fef2f2', borderRadius: 6, padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600 }}>{name}</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#991b1b' }}>Error: {source.error}</p>
        </div>
      );
    }

    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 16, overflow: 'hidden' }}>
        {/* Source header */}
        <div style={{ background: '#f3f4f6', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>{name}</h3>
          {spend && (
            <span style={{ fontSize: 18, fontWeight: 700, color: '#0066cc' }}>
              ${(spend.estimated_spend_usd ?? 0).toFixed(2)}
            </span>
          )}
        </div>

        {m && (
          <div style={{ padding: 16 }}>
            {/* Canonical Tier B fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              {(m as any).totalActualSpendUsd !== undefined && (
                <div style={cell}>
                  <p style={label}>Total Spend</p>
                  <p style={value}>${((m as any).totalActualSpendUsd as number).toFixed(2)}</p>
                </div>
              )}
              {(m as any).totalActualTokens !== undefined && (
                <div style={cell}>
                  <p style={label}>Total Tokens</p>
                  <p style={value}>{((m as any).totalActualTokens as number).toLocaleString()}</p>
                </div>
              )}
              {(m as any).avgDailySpendUsd !== undefined && (
                <div style={cell}>
                  <p style={label}>Avg Daily Spend</p>
                  <p style={value}>${((m as any).avgDailySpendUsd as number).toFixed(2)}</p>
                </div>
              )}
              {((m as any).cachedTokenSavingsUsdAnthropic ?? (m as any).cachedTokenSavingsUsdClaudeCode) !== undefined && (
                <div style={cell}>
                  <p style={label}>Cache Savings</p>
                  <p style={{ ...value, color: '#16a34a' }}>${(((m as any).cachedTokenSavingsUsdAnthropic ?? (m as any).cachedTokenSavingsUsdClaudeCode ?? 0) as number).toFixed(2)}</p>
                </div>
              )}
              {/* Tier C canonical fields */}
              {(m as any).total_conversations !== undefined && (
                <div style={cell}>
                  <p style={label}>Conversations</p>
                  <p style={value}>{((m as any).total_conversations as number).toLocaleString()}</p>
                </div>
              )}
              {(m as any).active_days !== undefined && (
                <div style={cell}>
                  <p style={label}>Active Days</p>
                  <p style={value}>{(m as any).active_days}</p>
                </div>
              )}
              {(m as any).estimated_relative_cost_usd !== undefined && (
                <div style={cell}>
                  <p style={label}>Relative Cost</p>
                  <p style={value}>${((m as any).estimated_relative_cost_usd as number).toFixed(2)}</p>
                </div>
              )}
              {(m as any).estimated_token_volume !== undefined && (
                <div style={cell}>
                  <p style={label}>Token Vol.</p>
                  <p style={value}>{((m as any).estimated_token_volume as number).toLocaleString()}</p>
                </div>
              )}
            </div>

            {!isTierC && <EfficiencySignalCallout signal={m.efficiencySignal} />}

            {/* Model spend for Tier B, model chips for Tier C */}
            {!isTierC && modelSpendRows.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <p style={{ ...label, marginBottom: 6 }}>Model Spend</p>
                {modelSpendRows.map(row => (
                  <p key={row.model} style={{ margin: '2px 0', fontSize: 12, color: '#374151' }}>
                    {row.model}: {Math.round(row.share * 100)}% of spend
                  </p>
                ))}
              </div>
            )}
            {isTierC && (m as any).models_identified && ((m as any).models_identified as string[]).length > 0 && (
              <div style={{ marginTop: 10 }}>
                <p style={{ ...label, marginBottom: 6 }}>Models Identified</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {((m as any).models_identified as string[]).map(mod => (
                    <span key={mod} style={{ fontSize: 12, padding: '2px 8px', background: '#f3f4f6', borderRadius: 100, color: '#374151' }}>{mod}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── § 5  Recommendations ──────────────────────────────────────────────
  // No slice cap — show ALL recommendations
  const RecommendationsSection = () => {
    if (report.recommendations.length === 0) return null;
    return (
      <div>
        <h2 style={sectionHead}>Recommendations</h2>
        {report.recommendations.map((r, idx) => (
          <div key={r.id ?? idx} style={{ display: 'flex', gap: 12, marginBottom: 12, padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 6 }}>
            <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: r.severity === 'High' ? '#fee2e2' : r.severity === 'Medium' ? '#fef3c7' : '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: r.severity === 'High' ? '#991b1b' : r.severity === 'Medium' ? '#92400e' : '#065f46' }}>
              {idx + 1}
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#111827' }}>{r.title}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{r.body}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={root}>
      {/* Document header */}
      <div style={{ marginBottom: 32, borderBottom: '2px solid #e5e7eb', paddingBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px', color: '#0066cc' }}>Promptly</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>AI Spend Analysis Report</p>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Generated {generatedDate}</p>
      </div>

      {/* § 1 AnalysisHeader */}
      <AnalysisHeader />

      {/* § 2 MoneyByToolSection */}
      <MoneyByToolSection />

      {/* § 3 SpendingTrendSection */}
      <SpendingTrendSection />

      {/* § 4 Per-source cards */}
      <div>
        <h2 style={sectionHead}>AI Sources</h2>
        {sortedSources.map(s => <SourceCard key={s.source_id} source={s} />)}
      </div>

      {/* § 5 Recommendations — ALL, no slice cap */}
      <RecommendationsSection />
    </div>
  );
}
