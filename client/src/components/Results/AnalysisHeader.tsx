import React from 'react';
import type { TopRecommendationEntry } from '../../types/index.js';

interface AnalysisHeaderProps {
  totalSpend: number;
  spendLabel: 'Spend' | 'Estimated spend';
  dateRange: { start: string; end: string };
  sourceCount: number;
  topRecommendation?: TopRecommendationEntry;
}

export function AnalysisHeader({ totalSpend, spendLabel, dateRange, sourceCount, topRecommendation }: AnalysisHeaderProps) {
  const priorityColor = (priority: string) => {
    if (priority === 'High') return 'var(--color-critical)';
    if (priority === 'Medium') return 'var(--color-warning)';
    return 'var(--color-info)';
  };

  return (
    <div data-testid="analysis-header" style={{ marginBottom: 32, textAlign: 'center' }}>
      {/* Total spend hero */}
      <div className="kpi-hero num" style={{ color: 'var(--color-accent)', marginBottom: 4 }}>
        ${totalSpend.toFixed(2)}
      </div>
      <p style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {spendLabel}
        {' · '}{sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
        {' · '}{dateRange.start} – {dateRange.end}
      </p>

      {/* Top recommendation callout */}
      {topRecommendation && (
        <div
          data-testid="top-recommendation-callout"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 16,
            padding: '10px 16px',
            background: 'var(--color-bg-elevated)',
            border: `1px solid ${priorityColor(topRecommendation.severity)}`,
            borderRadius: 'var(--radius-lg)',
            maxWidth: 480,
          }}
        >
          <span style={{ fontSize: '1rem' }}>💡</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: priorityColor(topRecommendation.severity), marginBottom: 2 }}>
              Top recommendation
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              {topRecommendation.compact_headline || topRecommendation.title}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
