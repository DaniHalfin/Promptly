import React from 'react';
import type { SourceReport } from '../../types/index.js';
import { friendlySourceName } from '../../lib/modelNames.js';

export interface ModelSpendRow {
  model: string;
  share: number;
  costUsd: number;
  estimated: boolean;
}

interface ModelSpendMiniBarProps {
  source: SourceReport;
}

const fmtUsd = (n: number) => `$${n.toFixed(2)}`;

export function getModelSpendRows(source: SourceReport): ModelSpendRow[] {
  if (source.tier !== 'B' || source.source_id === 'chatgpt_export' || source.source_id === 'claude_export') {
    return [];
  }

  const metrics = (source.metrics as any) ?? {};
  const rows: ModelSpendRow[] = source.source_id === 'github_copilot'
    ? (metrics.copilotModelCostBreakdown ?? []).map((row: any) => ({
        model: row.model,
        share: Number(row.costShare ?? 0),
        costUsd: Number(row.costUsd ?? 0),
        estimated: false,
      }))
    : (metrics.modelBreakdown ?? []).map((row: any) => ({
        model: row.model,
        share: Number(row.estimatedCostShare ?? 0),
        costUsd: Number(row.estimatedCostUsd ?? 0),
        estimated: true,
      }));

  return rows
    .filter(row => row.model && Number.isFinite(row.share) && row.share > 0)
    .sort((a, b) => b.share - a.share);
}

function formatPercent(share: number): string {
  if (share > 0 && share < 0.001) return '<0.1%';
  return `${Math.round(share * 100)}%`;
}

export function ModelSpendMiniBar({ source }: ModelSpendMiniBarProps) {
  const rows = getModelSpendRows(source);
  if (rows.length === 0) return null;

  const dominant = rows[0];
  const sourceName = friendlySourceName(source.source_id);

  return (
    <figure
      data-testid="model-spend-mini-bar"
      aria-label="Model cost share"
      style={{ margin: '0 0 12px' }}
    >
      <figcaption style={{ marginBottom: 8 }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Most of your {sourceName} spend went to <strong style={{ color: 'var(--text-primary)' }}>{dominant.model}</strong> ({formatPercent(dominant.share)})
        </div>
      </figcaption>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(row => (
          <div key={row.model} data-testid={`model-spend-row-${row.model}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.model}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {formatPercent(row.share)} · {fmtUsd(row.costUsd)}
              </span>
            </div>
            <div
              aria-hidden="true"
              style={{
                height: 6,
                borderRadius: 'var(--radius-pill)',
                background: 'var(--color-bg-inset)',
                border: '1px solid var(--color-input-border)',
                overflow: 'hidden',
              }}
            >
              <div
                data-testid={`model-spend-fill-${row.model}`}
                style={{
                  width: `${Math.max(0.1, Math.min(100, row.share * 100))}%`,
                  height: '100%',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--color-accent)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Model cost share</caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col">Spend</th>
            <th scope="col">Percentage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.model}>
              <td>{row.model}</td>
              <td>{fmtUsd(row.costUsd)}</td>
              <td>{formatPercent(row.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
