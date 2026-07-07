import { RecommendationResult } from '../../types/index.js';
import type { Rule, RuleContext } from './index.js';

const STALE_THRESHOLD_DAYS = 30;

export const RC1: Rule = {
  id: 'RC1',
  severity: 'Low',
  evaluate(ctx: RuleContext): RecommendationResult[] {
    const chatgptMetrics = ctx.sources.find(s => s.sourceId === 'chatgpt_export');
    if (!chatgptMetrics) return [];

    const newestDate = chatgptMetrics.newest_conversation_date;
    if (!newestDate) return [];

    const newestMs = new Date(newestDate).getTime();
    if (Number.isNaN(newestMs)) return [];

    const daysSince = (Date.now() - newestMs) / 86_400_000;
    if (daysSince <= STALE_THRESHOLD_DAYS) return [];

    return [
      {
        id: 'RC1',
        severity: 'Low',
        title: 'Your ChatGPT Export data may be stale',
        body:
          `The most recent conversation in your ChatGPT Export is from ${newestDate}, ` +
          `which is ${Math.floor(daysSince)} days ago. Re-export your ChatGPT data to get fresh analytics.`,
        triggeringMetric: 'newest_conversation_date',
        triggeringValue: newestDate,
        sourceIds: ['chatgpt_export'],
        targetSourceId: 'chatgpt_export',
        topSlotEligible: false,
      },
    ];
  },
};
