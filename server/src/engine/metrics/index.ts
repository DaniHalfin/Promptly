import { PriceMap } from '../../data/priceMap.js';
import { classifyTier } from '../tiers.js';
import { NormalizedSourceData, SourceMetrics } from '../../types/index.js';
import { computeTierBMetrics } from './tierB.js';
import { computeTierCMetrics } from './tierC.js';

export { computeCrossSourceMetrics, selectTopRecommendation } from './crossSource.js';

export function computeSourceMetrics(data: NormalizedSourceData, priceMap: PriceMap): Partial<SourceMetrics> {
  const tier = classifyTier(data);

  if (tier === 'B') {
    return computeTierBMetrics(data, priceMap);
  }

  if (tier === 'C') {
    return computeTierCMetrics(data, priceMap);
  }

  return {};
}
