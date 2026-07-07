import React from 'react';
import type { SpendByToolEntry, TopRecommendationEntry } from '../../types/index.js';
import { SpendByToolBar } from './SpendByToolBar.js';
import { TopRecommendationLine } from './TopRecommendationLine.js';

interface MoneyByToolSectionProps {
  spendByTool: SpendByToolEntry[];
  topRecommendations?: TopRecommendationEntry[];
  onTopRecommendationClick?: (rec: TopRecommendationEntry) => void;
}

export function MoneyByToolSection({
  spendByTool,
  topRecommendations = [],
  onTopRecommendationClick = () => {},
}: MoneyByToolSectionProps) {
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
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {topRecommendations.length > 0 ? (
            topRecommendations.map(rec => (
              <TopRecommendationLine
                key={`${rec.id}-${rec.source_id}`}
                rec={rec}
                onActivate={onTopRecommendationClick}
              />
            ))
          ) : (
            <p
              data-testid="top-recommendations-empty"
              style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}
            >
              No optimization opportunities detected based on the data available. Connect additional sources or richer data tiers for deeper analysis.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
