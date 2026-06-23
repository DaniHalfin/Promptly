import { SourceAdapter, AdapterContext, AdapterResult } from './types.js';
import { NormalizedSourceData, NormalizedConversation } from '../types/index.js';
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
    return { valid: true, error: null };
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

    try {
      const text = ctx.fileBuffer.toString('utf-8');
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        throw new Error('Expected array of conversations');
      }

      const conversations: NormalizedConversation[] = [];
      let totalTokens = 0;

      for (const conv of data) {
        const messages = [];
        let userTokens = 0,
          assistantTokens = 0;
        let userMsgCount = 0,
          assistantMsgCount = 0;
        let multimodalSkipped = 0;

        // Walk the mapping tree
        if (conv.mapping) {
          for (const [, node] of Object.entries(conv.mapping)) {
            const msg = (node as any)?.message;
            if (!msg) continue;

            const role = msg.author?.role;
            if (role !== 'user' && role !== 'assistant') continue;

            let text = '';
            if (msg.content?.parts) {
              for (const part of msg.content.parts) {
                if (typeof part === 'string') {
                  text += part;
                } else {
                  multimodalSkipped++;
                }
              }
            }

            const tokens = encodeTokens(text);
            if (role === 'user') {
              userTokens += tokens;
              userMsgCount++;
            } else {
              assistantTokens += tokens;
              assistantMsgCount++;
            }
            messages.push(text);
          }
        }

        const totalConvTokens = userTokens + assistantTokens;
        const now = new Date().toISOString();
        const createTime = chatGptTimestampToIso(conv.create_time, now);
        const updateTime = chatGptTimestampToIso(conv.update_time, createTime);

        conversations.push({
          id: conv.id || Math.random().toString(),
          title: conv.title,
          createTime,
          updateTime,
          messageCount: messages.length,
          userMessageCount: userMsgCount,
          assistantMessageCount: assistantMsgCount,
          estimatedTotalTokens: totalConvTokens,
          estimatedUserTokens: userTokens,
          estimatedAssistantTokens: assistantTokens,
          multimodalPartsSkipped: multimodalSkipped,
        });
        totalTokens += totalConvTokens;
      }

      const periodStart = conversations.length > 0 ? new Date(Math.min(...conversations.map(c => new Date(c.createTime).getTime()))).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const periodEnd = conversations.length > 0 ? new Date(Math.max(...conversations.map(c => new Date(c.updateTime).getTime()))).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      const raw: NormalizedSourceData = {
        sourceId: 'chatgpt_export',
        conversations: conversations.length > 0 ? conversations : undefined,
        periodStart,
        periodEnd,
      };

      return {
        sourceId: 'chatgpt_export',
        tier: conversations.length > 0 ? 'C' : null,
        connected: true,
        error: null,
        raw,
        warnings: conversations.some(c => c.multimodalPartsSkipped > 0) ? ['Some multimodal content was skipped from token estimation'] : [],
      };
    } catch (err: any) {
      return {
        sourceId: 'chatgpt_export',
        tier: null,
        connected: false,
        error: { code: 'PARSE_ERROR', message: `Failed to parse file: ${err.message}`, retriable: false },
        raw: null,
        warnings: [],
      };
    }
  },
};

export default chatgptExportAdapter;
