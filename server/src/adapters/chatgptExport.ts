import { SourceAdapter, AdapterContext, AdapterResult } from './types.js';
import { NormalizedSourceData, DailyConversationActivityEntry } from '../types/index.js';
import { encodeTokens } from '../lib/tokenizer.js';

function chatGptTimestampToIso(timestamp: unknown, fallback: string): string {
  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    return new Date(timestamp * 1000).toISOString();
  }

  if (typeof timestamp === 'string' && timestamp.trim() !== '') {
    const numericTimestamp = Number(timestamp);
    if (Number.isFinite(numericTimestamp)) {
      return new Date(numericTimestamp * 1000).toISOString();
    }

    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return fallback;
}

const chatgptExportAdapter: SourceAdapter = {
  id: 'chatgpt_export',

  async validate() {
    // ChatGPT export is validated per-upload by the dedicated multipart route,
    // which inspects the actual file. At adapter-validate time no file is
    // available, so report the standard rolling-window default. A valid result
    // must always carry a defined daysAvailable (discriminated-union contract).
    return { valid: true, error: null, daysAvailable: 30 };
  },

  async run(ctx: AdapterContext): Promise<AdapterResult> {
    if (!ctx.fileBuffer) {
      return {
        sourceId: 'chatgpt_export',
        tier: null,
        connected: false,
        error: { code: 'MISSING_FILE', message: 'No file provided', retriable: false },
        raw: null,
        warnings: [],
      };
    }

    const now = new Date().toISOString();
    const nowDate = now.split('T')[0];

    // Parse JSON — explicit try/catch so we can distinguish parse errors from structural errors
    let data: unknown;
    try {
      const text = ctx.fileBuffer.toString('utf-8');
      data = JSON.parse(text);
    } catch {
      return {
        sourceId: 'chatgpt_export',
        tier: null,
        connected: false,
        error: { code: 'PARSE_ERROR', message: 'Failed to parse file: invalid JSON', retriable: false },
        raw: null,
        warnings: [],
      };
    }

    if (!Array.isArray(data)) {
      return {
        sourceId: 'chatgpt_export',
        tier: null,
        connected: false,
        error: { code: 'PARSE_ERROR', message: 'Failed to parse file: expected array of conversations', retriable: false },
        raw: null,
        warnings: [],
      };
    }

    const rawArray = data as Record<string, unknown>[];

    // Empty export — connected but no Tier C data
    if (rawArray.length === 0) {
      return {
        sourceId: 'chatgpt_export',
        tier: null,
        connected: true,
        error: null,
        raw: {
          sourceId: 'chatgpt_export',
          periodStart: nowDate,
          periodEnd: nowDate,
          chatgptAggregates: {
            total_conversations: 0,
            total_messages: 0,
            active_days: 0,
            models_identified: [],
            daily_conversation_activity: [],
            estimated_token_volume: 0,
            estimated_user_tokens: 0,
            estimated_assistant_tokens: 0,
          },
        },
        warnings: [],
      };
    }

    // Apply optional date window filter (inclusive on both ends, based on update_time)
    const { startDate, endDate } = ctx;
    let filteredArray = rawArray;

    if (startDate || endDate) {
      filteredArray = rawArray.filter(conv => {
        const updateTimeIso = chatGptTimestampToIso(conv.update_time, now);
        const updateDate = new Date(updateTimeIso);
        if (startDate && updateDate < startDate) return false;
        if (endDate) {
          // Inclusive: allow through to end of the endDate day
          const endOfDay = new Date(endDate);
          endOfDay.setUTCHours(23, 59, 59, 999);
          if (updateDate > endOfDay) return false;
        }
        return true;
      });
    }

    // Date window yielded no conversations
    if (filteredArray.length === 0) {
      const periodStart = startDate?.toISOString().split('T')[0] ?? nowDate;
      const periodEnd = endDate?.toISOString().split('T')[0] ?? nowDate;
      return {
        sourceId: 'chatgpt_export',
        tier: null,
        connected: true,
        error: null,
        raw: {
          sourceId: 'chatgpt_export',
          periodStart,
          periodEnd,
          chatgptAggregates: {
            total_conversations: 0,
            total_messages: 0,
            active_days: 0,
            models_identified: [],
            daily_conversation_activity: [],
            estimated_token_volume: 0,
            estimated_user_tokens: 0,
            estimated_assistant_tokens: 0,
          },
        },
        warnings: ['No conversations found in the selected date period'],
      };
    }

    // Compute canonical aggregates — DO NOT store message text, titles, or per-message content
    let totalMessages = 0;
    let estimatedUserTokens = 0;
    let estimatedAssistantTokens = 0;
    const modelSet = new Set<string>();
    const dailyCountMap = new Map<string, number>();
    let newestTimestamp = 0;
    let newestDate = '';

    for (const conv of filteredArray) {
      const updateTimeIso = chatGptTimestampToIso(conv.update_time, now);
      const updateDate = new Date(updateTimeIso);
      const dateStr = updateTimeIso.split('T')[0];

      if (updateDate.getTime() > newestTimestamp) {
        newestTimestamp = updateDate.getTime();
        newestDate = dateStr;
      }

      // Track daily conversation counts (no text stored)
      dailyCountMap.set(dateStr, (dailyCountMap.get(dateStr) ?? 0) + 1);

      // Extract model identifiers from conversation-level metadata (no text)
      const templateId = conv.conversation_template_id;
      if (typeof templateId === 'string' && templateId.trim()) {
        modelSet.add(templateId);
      }

      // Walk the mapping tree — aggregate token counts only, discard text immediately
      const mapping = conv.mapping;
      if (mapping && typeof mapping === 'object') {
        for (const node of Object.values(mapping as Record<string, unknown>)) {
          const msg = (node as any)?.message;
          if (!msg) continue;

          const role = msg.author?.role;
          if (role !== 'user' && role !== 'assistant') continue;

          // Extract model slug from message metadata (no text)
          const modelSlug = msg.metadata?.model_slug;
          if (typeof modelSlug === 'string' && modelSlug.trim()) {
            modelSet.add(modelSlug);
          }

          // Count tokens from text parts — DO NOT store the text itself
          let tokenCount = 0;
          if (msg.content?.parts) {
            for (const part of msg.content.parts) {
              if (typeof part === 'string') {
                tokenCount += encodeTokens(part);
                // part is immediately discarded — never assigned to any stored variable
              }
            }
          }

          if (role === 'user') {
            estimatedUserTokens += tokenCount;
          } else {
            estimatedAssistantTokens += tokenCount;
          }
          totalMessages++;
        }
      }
    }

    // Build daily activity series sorted ascending by date
    const daily_conversation_activity: DailyConversationActivityEntry[] =
      Array.from(dailyCountMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, conversation_count]) => ({ date, conversation_count }));

    const dates = daily_conversation_activity.map(d => d.date);
    const periodStart = dates[0] ?? nowDate;
    const periodEnd = dates[dates.length - 1] ?? periodStart;

    const raw: NormalizedSourceData = {
      sourceId: 'chatgpt_export',
      periodStart,
      periodEnd,
      // chatgptAggregates holds only structural counts/dates — zero text content
      chatgptAggregates: {
        total_conversations: filteredArray.length,
        total_messages: totalMessages,
        active_days: dailyCountMap.size,
        models_identified: Array.from(modelSet),
        daily_conversation_activity,
        estimated_token_volume: estimatedUserTokens + estimatedAssistantTokens,
        estimated_user_tokens: estimatedUserTokens,
        estimated_assistant_tokens: estimatedAssistantTokens,
        newest_conversation_date: newestDate || undefined,
      },
    };

    return {
      sourceId: 'chatgpt_export',
      tier: 'C',
      connected: true,
      error: null,
      raw,
      warnings: [],
    };
  },
};

export default chatgptExportAdapter;

