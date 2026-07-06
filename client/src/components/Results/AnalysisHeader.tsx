import React from 'react';

interface AnalysisHeaderProps {
  totalSpend: number;
  spendLabel: 'Spend' | 'Estimated spend';
  dateRange: { start: string; end: string };
  sourceCount: number;
  totalPotentialSavingsUsd?: number;
  actionableRecommendationCount?: number;
}

export function AnalysisHeader({
  totalSpend,
  spendLabel,
  dateRange,
  sourceCount,
  totalPotentialSavingsUsd = 0,
  actionableRecommendationCount = 0,
}: AnalysisHeaderProps) {
  const showPotentialSavings = totalPotentialSavingsUsd > 0 && actionableRecommendationCount > 0;

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

      {showPotentialSavings && (
        <div
          data-testid="potential-savings-callout"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 16,
            padding: '10px 16px',
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-positive)',
            borderRadius: 'var(--radius-lg)',
            maxWidth: 520,
          }}
        >
          <span style={{ fontSize: '1rem' }}>💡</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-positive-text)', marginBottom: 2 }}>
              Total potential savings
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              Save up to{' '}
              <strong style={{ color: 'var(--color-positive-text)' }}>${totalPotentialSavingsUsd.toFixed(2)}</strong>
              {' '}across {actionableRecommendationCount} {actionableRecommendationCount === 1 ? 'recommendation' : 'recommendations'}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
              Savings estimates are based on your usage patterns and may vary.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
