import { SourceAdapter, AdapterContext, AdapterResult } from './types.js';
import { NormalizedSourceData } from '../types/index.js';
import { httpGet, httpWithRetry } from '../lib/httpClient.js';

interface OpenAIUsageResponse {
  data?: Array<{ start_time?: number; results?: Array<{ model: string; input_tokens?: number; output_tokens?: number; input_cached_tokens?: number }> }>;
  has_more?: boolean;
  next_page?: string;
}

interface OpenAICostResponse {
  data?: Array<{ start_time?: number; amount?: { value?: number } | number }>;
  has_more?: boolean;
  next_page?: string;
}

const openaiAdapter: SourceAdapter = {
  id: 'openai',

  async validate(ctx: AdapterContext) {
    if (!ctx.credential) return { valid: false, error: { code: 'MISSING_CREDENTIAL', message: 'No API key provided', retriable: false } };
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 86400000);
      const start = Math.floor(startTime.getTime() / 1000);
      const end = Math.floor(endTime.getTime() / 1000);
      await httpGet<OpenAIUsageResponse>(
        `https://api.openai.com/v1/organization/usage/completions?start_time=${start}&end_time=${end}&limit=1`,
        { 'Authorization': `Bearer ${ctx.credential}` }
      );
      return { valid: true, error: null, daysAvailable: 30 };
    } catch (err: any) {
      if (err.message.includes('401')) {
        return { valid: false, error: { code: 'INVALID_KEY', message: 'Invalid or expired API key', retriable: false } };
      }
      if (err.message.includes('403')) {
        return { valid: false, error: { code: 'MISSING_SCOPE', message: 'This key does not have Admin permissions. Org-level admin keys are required.', retriable: false } };
      }
      return { valid: false, error: { code: 'NETWORK_ERROR', message: err.message, retriable: true } };
    }
  },

  async run(ctx: AdapterContext): Promise<AdapterResult> {
    if (!ctx.credential || !ctx.startDate || !ctx.endDate) {
      return {
        sourceId: 'openai',
        tier: null,
        connected: false,
        error: { code: 'MISSING_PARAMS', message: 'Missing required parameters', retriable: false },
        raw: null,
        warnings: [],
      };
    }

    try {
      const start = Math.floor(ctx.startDate.getTime() / 1000);
      const end = Math.floor(ctx.endDate.getTime() / 1000);

      // Fetch usage (tokens)
      const dailyTokensByModel: Array<{ date: string; model: string; inputTokens: number; outputTokens: number; cachedInputTokens: number }> = [];
      let hasMore = true;
      let page: string | null = null;

      while (hasMore) {
        const data = await httpWithRetry(() =>
          httpGet<OpenAIUsageResponse>(
            `https://api.openai.com/v1/organization/usage/completions?start_time=${start}&end_time=${end}&bucket_width=1d&limit=31${page ? `&page=${page}` : ''}`,
            { 'Authorization': `Bearer ${ctx.credential}` }
          )
        );

        if (data.data) {
          for (const bucket of data.data) {
            for (const model of bucket.results || []) {
              dailyTokensByModel.push({
                date: new Date(bucket.start_time! * 1000).toISOString().split('T')[0],
                model: model.model,
                inputTokens: model.input_tokens || 0,
                outputTokens: model.output_tokens || 0,
                cachedInputTokens: model.input_cached_tokens || 0,
              });
            }
          }
        }

        hasMore = data.has_more || false;
        page = data.next_page || null;
      }

      // Fetch costs
      const dailyCostUsd: Array<{ date: string; costUsd: number }> = [];
      page = null;
      hasMore = true;

      while (hasMore) {
        const data = await httpWithRetry(() =>
          httpGet<OpenAICostResponse>(
            `https://api.openai.com/v1/organization/costs?start_time=${start}&end_time=${end}&bucket_width=1d${page ? `&page=${page}` : ''}`,
            { 'Authorization': `Bearer ${ctx.credential}` }
          )
        );

        if (data.data) {
          for (const bucket of data.data) {
            const costValue = typeof bucket.amount === 'object' ? bucket.amount?.value : bucket.amount;
            dailyCostUsd.push({
              date: new Date(bucket.start_time! * 1000).toISOString().split('T')[0],
              costUsd: costValue || 0,
            });
          }
        }

        hasMore = data.has_more || false;
        page = data.next_page || null;
      }

      const raw: NormalizedSourceData = {
        sourceId: 'openai',
        dailyTokensByModel: dailyTokensByModel.length > 0 ? dailyTokensByModel : undefined,
        dailyCostUsd: dailyCostUsd.length > 0 ? dailyCostUsd : undefined,
        cachedTokensSupported: true,
        periodStart: ctx.startDate.toISOString(),
        periodEnd: ctx.endDate.toISOString(),
      };

      return {
        sourceId: 'openai',
        tier: dailyTokensByModel.length && dailyCostUsd.length ? 'B' : (dailyTokensByModel.length ? 'C' : null),
        connected: true,
        error: null,
        raw,
        warnings: [],
      };
    } catch (err: any) {
      return {
        sourceId: 'openai',
        tier: null,
        connected: false,
        error: { code: 'FETCH_ERROR', message: err.message, retriable: true },
        raw: null,
        warnings: [],
      };
    }
  },
};

export default openaiAdapter;
