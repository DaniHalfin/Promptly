import { RecommendationResult } from '../../types/index.js';
import type { Rule, RuleContext } from './index.js';

const LOW_ACTIVITY_THRESHOLD = 5;

export const RC4b: Rule = {
  id: 'RC4b',
  severity: 'Low',
  evaluate(ctx: RuleContext): RecommendationResult[] {
    const chatgptMetrics = ctx.sources.find(s => s.sourceId === 'chatgpt_export');
    if (!chatgptMetrics) return [];

    const totalConversations = chatgptMetrics.total_conversations;
    if (totalConversations === undefined) return [];
    if (totalConversations >= LOW_ACTIVITY_THRESHOLD) return [];

    return [
      {
        id: 'RC4b',
        severity: 'Low',
        title: 'Very low ChatGPT activity in this period',
        body:
          `Your ChatGPT Export contains only ${totalConversations} conversation${totalConversations === 1 ? '' : 's'} in this analysis window. ` +
          'This may reflect a limited analysis period or infrequent ChatGPT usage.',
        triggeringMetric: 'total_conversations',
        triggeringValue: totalConversations,
        sourceIds: ['chatgpt_export'],
        targetSourceId: 'chatgpt_export',
        topSlotEligible: false,
      },
    ];
  },
};
