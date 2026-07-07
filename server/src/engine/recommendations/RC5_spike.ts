import { RecommendationResult } from '../../types/index.js';
import type { Rule, RuleContext } from './index.js';

export const RC5: Rule = {
  id: 'RC5',
  severity: 'Medium',
  evaluate(ctx: RuleContext): RecommendationResult[] {
    const chatgptMetrics = ctx.sources.find(s => s.sourceId === 'chatgpt_export');
    if (!chatgptMetrics) return [];

    const spike = chatgptMetrics.spike_callout;
    if (!spike) return [];

    return [
      {
        id: 'RC5',
        severity: 'Medium',
        title: 'Unusual ChatGPT activity spike detected',
        body: spike.message,
        triggeringMetric: 'spike_callout',
        triggeringValue: spike.date,
        sourceIds: ['chatgpt_export'],
        targetSourceId: 'chatgpt_export',
        topSlotEligible: false,
      },
    ];
  },
};
