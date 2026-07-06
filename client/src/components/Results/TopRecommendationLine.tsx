import React from 'react';
import type { TopRecommendationEntry } from '../../types/index.js';
import { friendlySourceName } from '../../lib/modelNames.js';

interface TopRecommendationLineProps {
  rec: TopRecommendationEntry;
  onActivate: (rec: TopRecommendationEntry) => void;
}

function fallbackSavingsLabel(rec: TopRecommendationEntry): string {
  return rec.savings_label || `Save $${rec.estimated_savings_usd.toFixed(2)}`;
}

export function TopRecommendationLine({ rec, onActivate }: TopRecommendationLineProps) {
  const headline = rec.compact_headline || rec.title;
  const savingsLabel = fallbackSavingsLabel(rec);
  const sourceName = friendlySourceName(rec.source_id);

  return (
    <button
      type="button"
      data-testid={`top-recommendation-${rec.id}-${rec.source_id}`}
      aria-label={`${headline}. ${savingsLabel}. Jump to ${sourceName} recommendation.`}
      onClick={() => onActivate(rec)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minHeight: 44,
        padding: '10px 12px',
        border: '1px solid var(--color-input-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-inset)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{headline}</span>
      <strong style={{ fontSize: '0.8125rem', color: 'var(--color-positive-text)', whiteSpace: 'nowrap' }}>
        {savingsLabel}
      </strong>
    </button>
  );
}
