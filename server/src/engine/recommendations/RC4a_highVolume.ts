import { RecommendationResult } from '../../types/index.js';
import type { Rule, RuleContext } from './index.js';

const HIGH_VOLUME_THRESHOLD = 500;

export const RC4a: Rule = {
  id: 'RC4a',
  severity: 'Medium',
  evaluate(ctx: RuleContext): RecommendationResult[] {
    const chatgptMetrics = ctx.sources.find(s => s.sourceId === 'chatgpt_export');
    if (!chatgptMetrics) return [];

    const totalConversations = chatgptMetrics.total_conversations ?? 0;
    if (totalConversations <= HIGH_VOLUME_THRESHOLD) return [];

    return [
      {
        id: 'RC4a',
        severity: 'Medium',
        title: 'High ChatGPT conversation volume detected',
        body:
          `Your ChatGPT Export shows ${totalConversations.toLocaleString()} conversations. ` +
          'At this volume, connecting your OpenAI API key would provide accurate token-level cost tracking.',
        triggeringMetric: 'total_conversations',
        triggeringValue: totalConversations,
        sourceIds: ['chatgpt_export'],
        targetSourceId: 'chatgpt_export',
        topSlotEligible: false,
      },
    ];
  },
};
