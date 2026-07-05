import React from 'react';

interface TopRecommendation {
  id: string;
  title: string;
  priority: string;
}

interface AnalysisHeaderProps {
  totalSpend: number;
  dateRange: { start: string; end: string };
  sourceCount: number;
  topRecommendation?: TopRecommendation;
  isEstimated?: boolean;
}

export function AnalysisHeader({ totalSpend, dateRange, sourceCount, topRecommendation, isEstimated }: AnalysisHeaderProps) {
  const priorityColor = (priority: string) => {
    if (priority === 'High') return 'var(--color-critical)';
    if (priority === 'Medium') return 'var(--color-warning)';
    return 'var(--color-info)';
  };

  return (
    <div data-testid="analysis-header" style={{ marginBottom: 32, textAlign: 'center' }}>
      {/* Total spend hero */}
      <div className="kpi-hero num" style={{ color: 'var(--color-accent)', marginBottom: 4 }}>
        {isEstimated ? '~' : ''}${totalSpend.toFixed(2)}
      </div>
      <p style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {isEstimated ? 'Estimated' : 'Total'} AI Spend
        {' · '}{sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
        {' · '}{dateRange.start} – {dateRange.end}
      </p>
      {isEstimated && (
        <p style={{ fontSize: '0.75rem', color: 'var(--color-warning-text)', marginTop: 4 }}>
          ~ Includes ChatGPT Export estimated from conversation activity
        </p>
      )}

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
            border: `1px solid ${priorityColor(topRecommendation.priority)}`,
            borderRadius: 'var(--radius-lg)',
            maxWidth: 480,
          }}
        >
          <span style={{ fontSize: '1rem' }}>💡</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: priorityColor(topRecommendation.priority), marginBottom: 2 }}>
              Top recommendation
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              {topRecommendation.title}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
