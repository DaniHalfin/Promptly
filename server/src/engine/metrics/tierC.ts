import { SourceMetrics, NormalizedSourceData } from '../../types/index.js';
import { PriceMap, lookupPrice } from '../../data/priceMap.js';

export function computeTierCMetrics(data: NormalizedSourceData, priceMap: PriceMap): Partial<SourceMetrics> {
  const metrics: Partial<SourceMetrics> = {};

  // File export metrics (ChatGPT, Claude)
  if (data.conversations) {
    const conversations = data.conversations;
    const totalTokens = conversations.reduce((sum, c) => sum + (c.estimatedTotalTokens || 0), 0);

    // 7.13 Estimated total tokens
    metrics.estimatedTotalTokens = totalTokens;

    // 7.14 Conversation count
    metrics.conversationCount = conversations.length;

    // 7.15 Average conversation length
    metrics.avgConversationLengthTokens = conversations.length > 0 ? totalTokens / conversations.length : 0;

    // 7.16 Conversation length histogram
    const histogram: Record<string, number> = {
      '0-500': 0,
      '500-2000': 0,
      '2000-5000': 0,
      '5000-10000': 0,
      '10000-32000': 0,
      '32000+': 0,
    };
    for (const conv of conversations) {
      const tokens = conv.estimatedTotalTokens || 0;
      if (tokens < 500) histogram['0-500']++;
      else if (tokens < 2000) histogram['500-2000']++;
      else if (tokens < 5000) histogram['2000-5000']++;
      else if (tokens < 10000) histogram['5000-10000']++;
      else if (tokens < 32000) histogram['10000-32000']++;
      else histogram['32000+']++;
    }
    metrics.conversationLengthHistogram = Object.entries(histogram).map(([bucket, count]) => ({ bucket, count }));

    // 7.17 Long conversation fraction
    const longConvs = conversations.filter(c => (c.estimatedTotalTokens || 0) > 8000).length;
    metrics.longConversationFraction = conversations.length > 0 ? longConvs / conversations.length : 0;

    // 7.18 User vs assistant token share
    const totalUserTokens = conversations.reduce((sum, c) => sum + (c.estimatedUserTokens || 0), 0);
    const totalAssistantTokens = conversations.reduce((sum, c) => sum + (c.estimatedAssistantTokens || 0), 0);
    metrics.userTokenShare = totalTokens > 0 ? totalUserTokens / totalTokens : 0;
    metrics.assistantTokenShare = totalTokens > 0 ? totalAssistantTokens / totalTokens : 0;

    // 7.19 Estimated relative cost
    const baselineModel = data.sourceId === 'chatgpt_export' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022';
    const price = lookupPrice(priceMap, baselineModel);
    if (price) {
      metrics.estimatedRelativeCostUsd = totalUserTokens * price.input_cost_per_token + totalAssistantTokens * price.output_cost_per_token;
      metrics.baselineModelAssumption = baselineModel;
    }
  }

  return metrics;
}
