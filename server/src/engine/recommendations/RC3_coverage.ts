import { RecommendationResult } from '../../types/index.js';
import type { Rule, RuleContext } from './index.js';

const MIN_CHATGPT_SPEND_PCT = 5;

export const RC3: Rule = {
  id: 'RC3',
  severity: 'Medium',
  evaluate(ctx: RuleContext): RecommendationResult[] {
    // chatgpt_export must be connected with metrics
    const chatgptReport = ctx.reports.find(r => r.source_id === 'chatgpt_export');
    if (!chatgptReport?.metrics) return [];

    // At least one Tier B source must be connected with metrics
    const hasTierB = ctx.reports.some(r => r.tier === 'B' && r.connected && r.metrics !== null);
    if (!hasTierB) return [];

    // chatgpt estimated spend > 5% of total estimated spend
    const chatgptSpend =
      chatgptReport.metrics.estimated_relative_cost_usd ??
      chatgptReport.metrics.estimatedRelativeCostUsd ??
      0;

    const totalSpend = ctx.reports.reduce((sum, r) => {
      if (!r.metrics) return sum;
      if (r.tier === 'B') {
        return (
          sum +
          (r.metrics.totalSpendUsd ??
            r.metrics.totalActualSpendUsd ??
            r.metrics.copilotTotalCostUsd ??
            0)
        );
      }
      if (r.tier === 'C') {
        return (
          sum +
          (r.metrics.estimated_relative_cost_usd ??
            r.metrics.estimatedRelativeCostUsd ??
            0)
        );
      }
      return sum;
    }, 0);

    if (totalSpend === 0) return [];
    const chatgptPct = (chatgptSpend / totalSpend) * 100;
    if (chatgptPct <= MIN_CHATGPT_SPEND_PCT) return [];

    return [
      {
        id: 'RC3',
        severity: 'Medium',
        title: 'ChatGPT spend is a significant share of your total AI cost',
        body:
          `ChatGPT Export accounts for approximately ${chatgptPct.toFixed(1)}% of your estimated total AI spend. ` +
          'Consider connecting your OpenAI API account for more accurate billing data.',
        triggeringMetric: 'chatgpt_estimated_spend_pct',
        triggeringValue: `${chatgptPct.toFixed(1)}%`,
        sourceIds: ['chatgpt_export'],
        targetSourceId: 'chatgpt_export',
        topSlotEligible: false,
      },
    ];
  },
};
