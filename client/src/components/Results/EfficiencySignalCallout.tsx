import React from 'react';
import type { EfficiencySignal } from '../../types/index.js';

interface EfficiencySignalCalloutProps {
  signal?: EfficiencySignal;
}

export function EfficiencySignalCallout({ signal }: EfficiencySignalCalloutProps) {
  if (!signal || signal.kind === 'balanced') return null;

  const isInputHeavy = signal.kind === 'input_heavy';
  const background = isInputHeavy ? 'var(--color-warning-muted)' : 'var(--color-info-muted)';
  const border = isInputHeavy ? 'var(--color-warning)' : 'var(--color-info)';
  const text = isInputHeavy ? 'var(--color-warning-text)' : 'var(--text-primary)';

  return (
    <div
      data-testid="efficiency-signal-callout"
      role="note"
      style={{
        marginBottom: 12,
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${border}`,
        background,
      }}
    >
      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: text, marginBottom: 2 }}>
        {signal.headline}
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {signal.explanation}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
        Input/output ratio: {signal.inputOutputRatio.toFixed(1)}:1
      </div>
    </div>
  );
}
