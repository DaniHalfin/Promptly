import { PriceMap } from '../../data/priceMap.js';
import { RecommendationResult, SourceMetrics, SourceReport } from '../../types/index.js';
import { R1 } from './R1_promptCaching.js';
import { R2 } from './R2_modelDowngrade.js';
import { R3 } from './R3_verbosity.js';
import { R4 } from './R4_offPeak.js';

export interface RuleContext {
  sources: SourceMetrics[];
  reports: SourceReport[];
  priceMap: PriceMap;
}

export interface Rule {
  id: RecommendationResult['id'];
  severity: RecommendationResult['severity'];
  evaluate(ctx: RuleContext): RecommendationResult[];
}

const RULES: Rule[] = [R1, R2, R3, R4];

const SEVERITY_ORDER: Record<RecommendationResult['severity'], number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

export function generateRecommendations(reports: SourceReport[], priceMap: PriceMap): RecommendationResult[] {
  const ctx: RuleContext = {
    reports,
    sources: reports.map(report => report.metrics).filter((metrics): metrics is SourceMetrics => metrics !== null),
    priceMap,
  };

  return RULES.flatMap(rule => rule.evaluate(ctx)).sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
}
