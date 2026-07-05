import React from 'react';
import type { SpendByToolEntry } from '../../types/index.js';
import { SpendByToolBar } from './SpendByToolBar.js';

interface MoneyByToolSectionProps {
  spendByTool: SpendByToolEntry[];
}

export function MoneyByToolSection({ spendByTool }: MoneyByToolSectionProps) {
  return (
    <section data-testid="money-by-tool-section" style={{ marginBottom: 32 }}>
      <h2 style={{
        fontSize: 'var(--text-title)',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: 16,
        letterSpacing: '-0.01em',
      }}>
        Where is your money going?
      </h2>
      <div className="card" style={{ padding: '20px 24px' }}>
        <SpendByToolBar data={spendByTool} />
      </div>
    </section>
  );
}
