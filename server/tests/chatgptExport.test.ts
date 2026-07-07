import { describe, it, expect } from 'vitest';
import chatgptExportAdapter from '../src/adapters/chatgptExport.js';
import type { PriceMap } from '../src/data/priceMap.js';
import type { AdapterContext } from '../src/adapters/types.js';

// Minimal price map with gpt-4o so cost estimates work
const priceMap: PriceMap = new Map([
  ['gpt-4o', { input_cost_per_token: 0.0000025, output_cost_per_token: 0.00001 }],
]);

/** Build a minimal valid AdapterContext */
function ctx(buffer: Buffer | undefined, extra?: Partial<AdapterContext>): AdapterContext {
  return { fileBuffer: buffer, priceMap, ...extra };
}

/** JSON-encode and wrap in a Buffer */
function bufferOf(data: unknown): Buffer {
  return Buffer.from(JSON.stringify(data), 'utf-8');
}

/** Produce a synthetic ChatGPT conversation fixture */
function makeConversation(opts: {
  id?: string;
  update_time?: number;  // Unix seconds
  messages?: { role: 'user' | 'assistant'; text: string; model_slug?: string }[];
  template_id?: string;
}): Record<string, unknown> {
  const now = Date.now() / 1000;
  const mapping: Record<string, unknown> = {};

  (opts.messages ?? []).forEach((msg, i) => {
    mapping[`node-${i}`] = {
      message: {
        author: { role: msg.role },
        content: { parts: [msg.text] },
        metadata: msg.model_slug ? { model_slug: msg.model_slug } : {},
      },
    };
  });

  return {
    id: opts.id ?? `conv-${Math.random().toString(36).slice(2)}`,
    title: `Test Conversation ${opts.id ?? ''}`,
    create_time: opts.update_time ?? now - 3600,
    update_time: opts.update_time ?? now,
    conversation_template_id: opts.template_id,
    mapping: Object.keys(mapping).length > 0 ? mapping : undefined,
  };
}

// ─── file handling ───────────────────────────────────────────────────────────

describe('chatgptExport adapter — file handling', () => {
  it('returns MISSING_FILE error when ctx.fileBuffer is absent', async () => {
    const result = await chatgptExportAdapter.run(ctx(undefined));
    expect(result.error?.code).toBe('MISSING_FILE');
    expect(result.connected).toBe(false);
    expect(result.tier).toBeNull();
  });

  it('returns PARSE_ERROR when buffer is not valid JSON', async () => {
    const result = await chatgptExportAdapter.run(ctx(Buffer.from('not json at all')));
    expect(result.error?.code).toBe('PARSE_ERROR');
    expect(result.connected).toBe(false);
    expect(result.tier).toBeNull();
  });

  it('returns PARSE_ERROR when JSON is not an array', async () => {
    const result = await chatgptExportAdapter.run(ctx(bufferOf({ not: 'array' })));
    expect(result.error?.code).toBe('PARSE_ERROR');
    expect(result.connected).toBe(false);
  });

  it('sets tier to null and returns empty message when array is empty', async () => {
    const result = await chatgptExportAdapter.run(ctx(bufferOf([])));
    expect(result.tier).toBeNull();
    expect(result.connected).toBe(true);
    expect(result.error).toBeNull();
  });
});

// ─── valid parsing ────────────────────────────────────────────────────────────

describe('chatgptExport adapter — valid parsing', () => {
  // Two conversations on different days
  const ts1 = new Date('2026-01-14T10:00:00Z').getTime() / 1000;
  const ts2 = new Date('2026-01-15T10:00:00Z').getTime() / 1000;

  const conv1 = makeConversation({
    id: 'c1',
    update_time: ts1,
    messages: [
      { role: 'user', text: 'Hello world', model_slug: undefined },
      { role: 'assistant', text: 'Hi there', model_slug: 'gpt-4o' },
    ],
  });
  const conv2 = makeConversation({
    id: 'c2',
    update_time: ts2,
    messages: [
      { role: 'user', text: 'Another message' },
      { role: 'assistant', text: 'Another reply' },
    ],
    template_id: 'gpt-4',
  });
  const data = [conv1, conv2];

  it('counts total_conversations from top-level array length', async () => {
    const result = await chatgptExportAdapter.run(ctx(bufferOf(data)));
    expect(result.raw?.chatgptAggregates?.total_conversations).toBe(2);
  });

  it('counts total_messages from user + assistant nodes in mapping (excludes system/tool nodes)', async () => {
    // 2 messages per conversation × 2 conversations = 4
    const result = await chatgptExportAdapter.run(ctx(bufferOf(data)));
    expect(result.raw?.chatgptAggregates?.total_messages).toBe(4);
  });

  it('counts active_days as number of distinct YYYY-MM-DD dates from conversation timestamps', async () => {
    const result = await chatgptExportAdapter.run(ctx(bufferOf(data)));
    // ts1 = 2026-01-14, ts2 = 2026-01-15 → 2 distinct dates
    expect(result.raw?.chatgptAggregates?.active_days).toBe(2);
  });

  it('extracts models_identified from conversation metadata (conversation_template_id or message model field)', async () => {
    const result = await chatgptExportAdapter.run(ctx(bufferOf(data)));
    const models = result.raw?.chatgptAggregates?.models_identified ?? [];
    expect(models).toContain('gpt-4o');   // from message model_slug
    expect(models).toContain('gpt-4');    // from conversation_template_id
  });

  it('models_identified is [] when no model metadata is present in any conversation', async () => {
    const noModel = [makeConversation({
      messages: [{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'hello' }],
    })];
    const result = await chatgptExportAdapter.run(ctx(bufferOf(noModel)));
    expect(result.raw?.chatgptAggregates?.models_identified).toHaveLength(0);
  });

  it('newest_conversation_date is the ISO date of the most recent update_time', async () => {
    const result = await chatgptExportAdapter.run(ctx(bufferOf(data)));
    // Most recent is ts2 = 2026-01-15
    expect(result.raw?.chatgptAggregates?.newest_conversation_date).toBe('2026-01-15');
  });

  it('daily_conversation_activity has one entry per distinct date, sorted ascending', async () => {
    const result = await chatgptExportAdapter.run(ctx(bufferOf(data)));
    const activity = result.raw?.chatgptAggregates?.daily_conversation_activity ?? [];
    expect(activity.length).toBe(2);
    // Sorted ascending
    expect(activity[0].date <= activity[1].date).toBe(true);
    // Each entry has a positive count
    expect(activity.every(d => d.conversation_count > 0)).toBe(true);
  });

  it('estimated_token_volume is sum of user + assistant estimated tokens across all conversations', async () => {
    const result = await chatgptExportAdapter.run(ctx(bufferOf(data)));
    const vol = result.raw?.chatgptAggregates?.estimated_token_volume ?? 0;
    expect(vol).toBeGreaterThan(0);
  });

  it('sets tier to C when at least one conversation is present', async () => {
    const result = await chatgptExportAdapter.run(ctx(bufferOf(data)));
    expect(result.tier).toBe('C');
  });

  it('sets connected to true and error to null on success', async () => {
    const result = await chatgptExportAdapter.run(ctx(bufferOf(data)));
    expect(result.connected).toBe(true);
    expect(result.error).toBeNull();
  });
});

// ─── date window filtering ────────────────────────────────────────────────────

describe('chatgptExport adapter — date window filtering', () => {
  const before = new Date('2026-01-10T12:00:00Z');
  const mid    = new Date('2026-01-15T12:00:00Z');
  const after  = new Date('2026-01-20T12:00:00Z');

  const conv1 = makeConversation({ id: 'd1', update_time: before.getTime() / 1000 });
  const conv2 = makeConversation({ id: 'd2', update_time: mid.getTime() / 1000 });
  const conv3 = makeConversation({ id: 'd3', update_time: after.getTime() / 1000 });
  const data = [conv1, conv2, conv3];

  it('excludes conversations whose update_time is before the requested startDate', async () => {
    const result = await chatgptExportAdapter.run(ctx(bufferOf(data), {
      startDate: new Date('2026-01-12T00:00:00Z'),
    }));
    // conv1 (Jan 10) excluded; conv2+conv3 remain
    expect(result.raw?.chatgptAggregates?.total_conversations).toBe(2);
  });

  it('excludes conversations whose update_time is after the requested endDate', async () => {
    const result = await chatgptExportAdapter.run(ctx(bufferOf(data), {
      endDate: new Date('2026-01-18T00:00:00Z'),
    }));
    // conv3 (Jan 20) excluded; conv1+conv2 remain
    expect(result.raw?.chatgptAggregates?.total_conversations).toBe(2);
  });

  it('includes conversations on boundary dates (inclusive on both ends)', async () => {
    const result = await chatgptExportAdapter.run(ctx(bufferOf(data), {
      startDate: new Date('2026-01-10T00:00:00Z'),
      endDate: new Date('2026-01-20T00:00:00Z'),
    }));
    // All three conversations fall within the inclusive range
    expect(result.raw?.chatgptAggregates?.total_conversations).toBe(3);
  });

  it('returns empty-period error/message when date window yields zero conversations', async () => {
    const result = await chatgptExportAdapter.run(ctx(bufferOf(data), {
      startDate: new Date('2026-02-01T00:00:00Z'),
      endDate: new Date('2026-02-28T00:00:00Z'),
    }));
    expect(result.raw?.chatgptAggregates?.total_conversations).toBe(0);
    // Must surface a useful message about the empty period
    expect(result.warnings.some(w => /period/i.test(w) || /no conversation/i.test(w))).toBe(true);
  });
});

// ─── privacy ──────────────────────────────────────────────────────────────────

describe('chatgptExport adapter — privacy', () => {
  const PROMPT_TEXT = 'UNIQUE_SECRET_PROMPT_TEXT_12345';
  const RESPONSE_TEXT = 'UNIQUE_SECRET_RESPONSE_TEXT_67890';

  const conv = makeConversation({
    messages: [
      { role: 'user', text: PROMPT_TEXT },
      { role: 'assistant', text: RESPONSE_TEXT },
    ],
  });

  it('does not include message text in returned raw NormalizedSourceData', async () => {
    const result = await chatgptExportAdapter.run(ctx(bufferOf([conv])));
    const rawJson = JSON.stringify(result.raw);
    expect(rawJson).not.toContain(PROMPT_TEXT);
    expect(rawJson).not.toContain(RESPONSE_TEXT);
  });

  it('does not include message text in warnings array', async () => {
    const result = await chatgptExportAdapter.run(ctx(bufferOf([conv])));
    const warningsJson = JSON.stringify(result.warnings);
    expect(warningsJson).not.toContain(PROMPT_TEXT);
    expect(warningsJson).not.toContain(RESPONSE_TEXT);
  });

  it('does not expose messages array in returned raw', async () => {
    const result = await chatgptExportAdapter.run(ctx(bufferOf([conv])));
    // raw must not contain a 'messages' property or the legacy conversations array
    expect(result.raw).not.toHaveProperty('messages');
    expect(result.raw?.conversations).toBeUndefined();
  });
});

// ─── credentials contract ────────────────────────────────────────────────────

describe('chatgptExport adapter — credentials contract', () => {
  const conv = makeConversation({
    messages: [{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'hello' }],
  });

  it('accepts null credential without error', async () => {
    // File-based adapters do not require API credentials; no credential → success
    const result = await chatgptExportAdapter.run({
      fileBuffer: bufferOf([conv]),
      priceMap,
      // credential is absent / undefined (equivalent of null)
    });
    expect(result.connected).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts any non-null string credential (credentials are ignored for file uploads)', async () => {
    // Passing a credential string should not cause errors — it is silently ignored
    const result = await chatgptExportAdapter.run({
      fileBuffer: bufferOf([conv]),
      credential: 'sk-any-key-is-ignored',
      priceMap,
    });
    expect(result.connected).toBe(true);
    expect(result.error).toBeNull();
  });
});
