import React from 'react';
import type { DailySpendEntry, TrendStatus, SpikeCallout } from '../../types/index.js';

interface SpendingTrendSectionProps {
  dailySpend: DailySpendEntry[];
  trend: TrendStatus;
  spikeCallout: SpikeCallout | null;
}

function TrendBadge({ trend }: { trend: TrendStatus }) {
  if (trend.status === 'available') {
    const pct = trend.mom_change_pct;
    const up = pct > 0;
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 'var(--radius-pill)',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: up ? 'var(--color-critical-muted)' : 'var(--color-positive-muted)',
        color: up ? 'var(--color-critical-text)' : 'var(--color-positive-text)',
      }}>
        {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}% MoM
      </span>
    );
  }
  return (
    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
      {trend.message}
    </span>
  );
}

export function SpendingTrendSection({ dailySpend, trend, spikeCallout }: SpendingTrendSectionProps) {
  return (
    <section data-testid="spending-trend-section" style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{
          fontSize: 'var(--text-title)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
          margin: 0,
        }}>
          Spending Trend
        </h2>
        <TrendBadge trend={trend} />
      </div>

      {/* Spike callout banner */}
      {spikeCallout && (
        <div
          data-testid="spike-callout"
          style={{
            background: 'var(--color-warning-muted)',
            border: '1px solid var(--color-warning)',
            borderRadius: 'var(--radius-lg)',
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <span style={{ fontSize: '1rem' }}>⚡</span>
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-warning-text)', fontSize: '0.875rem' }}>
              Spike detected on {spikeCallout.date}
            </p>
            <p style={{ margin: '2px 0 0', color: 'var(--color-warning-text)', fontSize: '0.8125rem', opacity: 0.85 }}>
              {spikeCallout.message}
            </p>
          </div>
        </div>
      )}

      {/* Daily spend chart — simple sr-only table for now; visual chart can be added */}
      {dailySpend.length > 0 ? (
        <div className="card" style={{ padding: '20px 24px' }}>
          {/* sr-only data table */}
          <figure aria-label="Daily spend trend">
            <figcaption className="sr-only">
              <table>
                <thead>
                  <tr><th>Date</th><th>Spend (USD)</th></tr>
                </thead>
                <tbody>
                  {dailySpend.map(entry => (
                    <tr key={entry.date}>
                      <td>{entry.date}</td>
                      <td>${entry.spend_usd.toFixed(4)}{entry.includes_estimated_tier_c ? ' (est.)' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </figcaption>
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {dailySpend.length} days of data
              {dailySpend.some(d => d.includes_estimated_tier_c) && (
                <span style={{ marginLeft: 8, color: 'var(--color-warning-text)', fontSize: '0.75rem' }}>
                  ~ includes ChatGPT Export estimates
                </span>
              )}
            </div>
          </figure>
        </div>
      ) : (
        <div className="card" style={{ padding: '20px 24px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No daily spend data available.
        </div>
      )}
    </section>
  );
}
