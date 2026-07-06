import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MoneyByToolSection } from '../src/components/Results/MoneyByToolSection';
import type { SpendByToolEntry, TopRecommendationEntry } from '../src/types/index.js';

const spendByTool: SpendByToolEntry[] = [
  { source_id: 'anthropic', display_name: 'Anthropic', estimated_spend_usd: 10, percentage_of_total: 100, tier: 'B', is_estimated: false, rank: 1 },
];

const rec: TopRecommendationEntry = {
  id: 'R1',
  title: 'Anthropic prompt caching opportunity',
  compact_headline: 'Enable prompt caching',
  source_id: 'anthropic',
  target_card_anchor: '#tool-card-anthropic',
  target_recommendation_anchor: '#rec-anthropic-R1',
  estimated_savings_usd: 12.34,
  savings_label: 'Save ~$12.34',
  severity: 'Medium',
};

describe('MoneyByToolSection top recommendations', () => {
  it('renders top recommendation lines under the spend bar', () => {
    render(<MoneyByToolSection spendByTool={spendByTool} topRecommendations={[rec]} />);
    expect(screen.getByTestId('top-recommendation-R1-anthropic')).toBeInTheDocument();
    expect(screen.getByText('Enable prompt caching')).toBeInTheDocument();
    expect(screen.getByText('Save ~$12.34')).toBeInTheDocument();
  });

  it('renders empty optimization-opportunities state when no top recommendations exist', () => {
    render(<MoneyByToolSection spendByTool={spendByTool} topRecommendations={[]} />);
    expect(screen.getByTestId('top-recommendations-empty')).toHaveTextContent('No optimization opportunities detected');
  });

  it('calls onTopRecommendationClick with the selected recommendation', () => {
    const onClick = vi.fn();
    render(<MoneyByToolSection spendByTool={spendByTool} topRecommendations={[rec]} onTopRecommendationClick={onClick} />);
    fireEvent.click(screen.getByTestId('top-recommendation-R1-anthropic'));
    expect(onClick).toHaveBeenCalledWith(rec);
  });
});
