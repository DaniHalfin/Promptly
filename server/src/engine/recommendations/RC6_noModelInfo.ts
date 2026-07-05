import { RecommendationResult } from '../../types/index.js';
import type { Rule, RuleContext } from './index.js';

export const RC6: Rule = {
  id: 'RC6',
  severity: 'Low',
  evaluate(ctx: RuleContext): RecommendationResult[] {
    const chatgptMetrics = ctx.sources.find(s => s.sourceId === 'chatgpt_export');
    if (!chatgptMetrics) return [];

    const modelsIdentified = chatgptMetrics.models_identified;
    // Only fires when models_identified is an empty array (not undefined/null)
    if (!Array.isArray(modelsIdentified) || modelsIdentified.length > 0) return [];

    return [
      {
        id: 'RC6',
        severity: 'Low',
        title: 'No model information found in ChatGPT Export',
        body:
          'Your ChatGPT Export does not contain model metadata. ' +
          'This means Promptly cannot identify which ChatGPT models you used. ' +
          'Exports from older conversation dates or limited exports may lack model information.',
        triggeringMetric: 'models_identified',
        triggeringValue: '',
        sourceIds: ['chatgpt_export'],
        targetSourceId: 'chatgpt_export',
        topSlotEligible: false,
      },
    ];
  },
};
