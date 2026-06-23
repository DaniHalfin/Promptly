import { SourceAdapter, AdapterContext, AdapterResult } from './types.js';
import { NormalizedSourceData, NormalizedUsageRecord } from '../types/index.js';
import { httpGet, httpWithRetry } from '../lib/httpClient.js';

interface AnthropicUsageResponse {
  data?: Array<{
    starting_at: string;
    ending_at: string;
    results?: Array<{
      model?: string | null;
      uncached_input_tokens?: number;
      output_tokens?: number;
      cache_creation?: {
        ephemeral_1h_input_tokens?: number;
        ephemeral_5m_input_tokens?: number;
      };
      cache_read_input_tokens?: number;
    }>;
  }>;
  has_more?: boolean;
  next_page?: string | null;
}

interface AnthropicCostResponse {
  data?: Array<{
    starting_at: string;
    ending_at: string;
    results?: Array<{
      amount?: string;
      currency?: string;
    }>;
  }>;
  has_more?: boolean;
  next_page?: string | null;
}

const ANTHROPIC_API_BASE = 'https://api.anthropic.com';
const ANTHROPIC_HEADERS = (apiKey: string) => ({
  'x-api-key': apiKey,
  'anthropic-version': '2023-06-01',
});

function buildUrl(path: string, params: Record<string, string | undefined>, groupBy?: string[]) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, value);
  }
  for (const group of groupBy || []) {
    search.append('group_by[]', group);
  }
  return `${ANTHROPIC_API_BASE}${path}?${search.toString()}`;
}

function toCostUsd(amountInLowestCurrencyUnit?: string, currency?: string) {
  if (!amountInLowestCurrencyUnit || (currency && currency !== 'USD')) return 0;
  const parsedAmount = Number.parseFloat(amountInLowestCurrencyUnit);
  return Number.isFinite(parsedAmount) ? parsedAmount / 100 : 0;
}

const anthropicAdapter: SourceAdapter = {
  id: 'anthropic',

  async validate(ctx: AdapterContext) {
    if (!ctx.credential) return { valid: false, error: { code: 'MISSING_CREDENTIAL', message: 'No API key provided', retriable: false } };
    try {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 86400000);
      await httpGet<AnthropicUsageResponse>(
        buildUrl('/v1/organizations/usage_report/messages', {
          starting_at: now.toISOString(),
          ending_at: tomorrow.toISOString(),
          bucket_width: '1d',
          limit: '1',
        }),
        ANTHROPIC_HEADERS(ctx.credential)
      );
      return { valid: true, error: null, daysAvailable: 30 };
    } catch (err: any) {
      if (err.message.includes('401')) {
        return { valid: false, error: { code: 'INVALID_KEY', message: 'Invalid or expired API key', retriable: false } };
      }
      if (err.message.includes('403')) {
        return { valid: false, error: { code: 'MISSING_SCOPE', message: 'Org-level admin key required for usage reports', retriable: false } };
      }
      return { valid: false, error: { code: 'NETWORK_ERROR', message: err.message, retriable: true } };
    }
  },

  async run(ctx: AdapterContext): Promise<AdapterResult> {
    if (!ctx.credential || !ctx.startDate || !ctx.endDate) {
      return {
        sourceId: 'anthropic',
        tier: null,
        connected: false,
        error: { code: 'MISSING_PARAMS', message: 'Missing required parameters', retriable: false },
        raw: null,
        warnings: [],
      };
    }

    try {
      const credential = ctx.credential;
      const start = ctx.startDate.toISOString();
      const end = ctx.endDate.toISOString();

      // Fetch usage (tokens)
      const dailyTokensByModel: NormalizedUsageRecord[] = [];
      let page: string | null = null;
      let hasMore = true;

      while (hasMore) {
        const data = await httpWithRetry(() =>
          httpGet<AnthropicUsageResponse>(
            buildUrl('/v1/organizations/usage_report/messages', {
              starting_at: start,
              ending_at: end,
              bucket_width: '1d',
              limit: '31',
              page: page || undefined,
            }, ['model']),
            ANTHROPIC_HEADERS(credential)
          )
        );

        if (data.data) {
          for (const bucket of data.data) {
            for (const record of bucket.results || []) {
              const cacheCreationInputTokens =
                (record.cache_creation?.ephemeral_1h_input_tokens || 0) +
                (record.cache_creation?.ephemeral_5m_input_tokens || 0);
              const cacheReadInputTokens = record.cache_read_input_tokens || 0;

              dailyTokensByModel.push({
                date: bucket.starting_at.split('T')[0],
                model: record.model || 'unknown',
                inputTokens: record.uncached_input_tokens || 0,
                outputTokens: record.output_tokens || 0,
                cachedInputTokens: cacheReadInputTokens,
                cacheCreationInputTokens,
                cacheReadInputTokens,
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
          httpGet<AnthropicCostResponse>(
            buildUrl('/v1/organizations/cost_report', {
              starting_at: start,
              ending_at: end,
              bucket_width: '1d',
              limit: '31',
              page: page || undefined,
            }),
            ANTHROPIC_HEADERS(credential)
          )
        );

        if (data.data) {
          for (const bucket of data.data) {
            dailyCostUsd.push({
              date: bucket.starting_at.split('T')[0],
              costUsd: (bucket.results || []).reduce((sum, item) => sum + toCostUsd(item.amount, item.currency), 0),
            });
          }
        }

        hasMore = data.has_more || false;
        page = data.next_page || null;
      }

      const raw: NormalizedSourceData = {
        sourceId: 'anthropic',
        dailyTokensByModel: dailyTokensByModel.length > 0 ? dailyTokensByModel : undefined,
        dailyCostUsd: dailyCostUsd.length > 0 ? dailyCostUsd : undefined,
        cachedTokensSupported: true,
        periodStart: start,
        periodEnd: end,
      };

      return {
        sourceId: 'anthropic',
        tier: dailyTokensByModel.length && dailyCostUsd.length ? 'B' : (dailyTokensByModel.length ? 'C' : null),
        connected: true,
        error: null,
        raw,
        warnings: [],
      };
    } catch (err: any) {
      return {
        sourceId: 'anthropic',
        tier: null,
        connected: false,
        error: { code: 'FETCH_ERROR', message: err.message, retriable: true },
        raw: null,
        warnings: [],
      };
    }
  },
};

export default anthropicAdapter;
