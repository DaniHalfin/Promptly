import React from 'react';
import type { SpendByToolEntry } from '../../types/index.js';

interface SpendByToolBarProps {
  data: SpendByToolEntry[];
}

export function SpendByToolBar({ data }: SpendByToolBarProps) {
  if (!data || data.length === 0) {
    return (
      <figure aria-label="Spend by tool">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '16px 0' }}>No spend data available.</p>
      </figure>
    );
  }

  const sorted = [...data].sort((a, b) => b.estimated_spend_usd - a.estimated_spend_usd);
  const maxSpend = sorted[0].estimated_spend_usd || 1;

  return (
    // WP-9: <figure> with sr-only data table for accessibility
    <figure aria-label="Spend by tool">
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr><th scope="col">Tool</th><th scope="col">Estimated Spend</th><th scope="col">Percentage</th></tr>
          </thead>
          <tbody>
            {sorted.map(entry => (
              <tr key={entry.source_id}>
                <td>{entry.display_name}</td>
                <td>${entry.estimated_spend_usd.toFixed(2)}</td>
                <td>{entry.percentage_of_total.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(entry => {
          const widthPct = maxSpend > 0 ? (entry.estimated_spend_usd / maxSpend) * 100 : 0;
          return (
            <div key={entry.source_id} data-testid={`spend-bar-${entry.source_id}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.8125rem' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {entry.display_name}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  ${entry.estimated_spend_usd.toFixed(2)}
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                    {entry.percentage_of_total.toFixed(1)}%
                  </span>
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 'var(--radius-pill)',
                  overflow: 'hidden',
                }}
              >
                <div
                  data-testid={`spend-bar-fill-${entry.source_id}`}
                  style={{
                    height: '100%',
                    width: `${widthPct}%`,
                    background: 'var(--color-accent)',
                    borderRadius: 'var(--radius-pill)',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
