import { describe, expect, it } from 'vitest';
import { isModelCostEstimated, lookupPrice, type PriceEntry, type PriceMap } from '../data/priceMap.js';

const entry = (input: number, output: number): PriceEntry => ({
  input_cost_per_token: input,
  output_cost_per_token: output,
});

describe('priceMap', () => {
  it('returns the exact model key match', () => {
    const exact = entry(0.001, 0.002);
    const map: PriceMap = new Map([['gpt-exact', exact]]);

    expect(lookupPrice(map, 'gpt-exact')).toBe(exact);
  });

  it('returns a prefix match when the lookup model is shorter than the price-map key', () => {
    const opus = entry(0.015, 0.075);
    const map: PriceMap = new Map([['claude-3-opus-20240229', opus]]);

    expect(lookupPrice(map, 'claude-3')).toBe(opus);
  });

  it('uses the longest key when multiple keys could match', () => {
    const base = entry(1, 2);
    const mini = entry(0.1, 0.2);
    const map: PriceMap = new Map([
      ['gpt-5.4', base],
      ['gpt-5.4-mini', mini],
    ]);

    expect(lookupPrice(map, 'gpt-5.4-mini')).toBe(mini);
    expect(lookupPrice(map, 'gpt-5.4-mini-202606')).toBe(mini);
  });

  it('returns null for an unknown model', () => {
    const map: PriceMap = new Map([['known-model', entry(1, 2)]]);

    expect(lookupPrice(map, 'unknown-model')).toBeNull();
  });

  it('marks only OpenAI model cost as estimated', () => {
    expect(isModelCostEstimated('openai')).toBe(true);
    expect(isModelCostEstimated('anthropic')).toBe(false);
    expect(isModelCostEstimated('claude_code')).toBe(false);
  });
});
