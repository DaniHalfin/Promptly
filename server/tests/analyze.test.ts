/**
 * analyze.test.ts — HTTP integration tests for per-source and recommendations routes.
 * Starts the express app on a random OS-assigned port, uses native fetch.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { Application } from 'express';
import { createApp } from '../src/index.js';
import type { SourceReport, AnalysisReport } from '../src/types/index.js';

let app: Application;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  app = await createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://localhost:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Build a minimal valid ChatGPT conversations buffer */
function chatgptBuffer(): Buffer {
  const convs = [
    {
      id: 'conv-1',
      update_time: new Date('2026-06-15T12:00:00Z').getTime() / 1000,
      mapping: {
        n0: { message: { author: { role: 'user' }, content: { parts: ['hello'] }, metadata: {} } },
        n1: { message: { author: { role: 'assistant' }, content: { parts: ['hi'] }, metadata: { model_slug: 'gpt-4o' } } },
      },
    },
  ];
  return Buffer.from(JSON.stringify(convs), 'utf-8');
}

describe('analyze routes', () => {
  it('POST /api/analyze/chatgpt_export with multipart file upload succeeds', async () => {
    const formData = new FormData();
    const blob = new Blob([chatgptBuffer()], { type: 'application/json' });
    formData.append('chatgpt_export', blob, 'conversations.json');

    const res = await fetch(`${baseUrl}/api/analyze/chatgpt_export`, {
      method: 'POST',
      body: formData,
    });
    expect(res.status).toBe(200);
    const report = await res.json() as SourceReport;
    expect(report.source_id).toBe('chatgpt_export');
    expect(report.connected).toBe(true);
    expect(report.tier).toBe('C');
  });

  it('POST /api/analyze/github_copilot with API key returns SourceReport', async () => {
    // Point the Copilot adapter at an empty temp dir so it completes instantly (no real sessions)
    const emptyDir = join(tmpdir(), `copilot-test-${Date.now()}`);
    mkdirSync(emptyDir, { recursive: true });
    process.env.COPILOT_SESSION_STATE_DIR = emptyDir;

    try {
      const res = await fetch(`${baseUrl}/api/analyze/github_copilot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Credential-GitHub': 'unused-for-copilot',
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const report = await res.json() as SourceReport;
      expect(report.source_id).toBe('github_copilot');
      // Returns a report regardless of whether any sessions exist
      expect(typeof report.connected).toBe('boolean');
    } finally {
      delete process.env.COPILOT_SESSION_STATE_DIR;
      rmSync(emptyDir, { recursive: true, force: true });
    }
  }, 15_000);

  it('POST /api/analyze/:sourceId error does not affect other sources', async () => {
    // Call with an unknown source — should return a SourceReport with an error, not a 500
    const res = await fetch(`${baseUrl}/api/analyze/unknown_source_xyz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const report = await res.json() as SourceReport;
    expect(report.source_id).toBe('unknown_source_xyz');
    expect(report.error).toBeTruthy();
    expect(report.connected).toBe(false);
  });

  it('POST /api/analyze/recommendations with settled source reports returns merged AnalysisReport', async () => {
    // Build a minimal settled SourceReport from the chatgpt_export source
    const sources: SourceReport[] = [
      {
        source_id: 'chatgpt_export',
        tier: 'C',
        connected: true,
        error: null,
        metrics: {
          sourceId: 'chatgpt_export',
          tier: 'C',
          periodStart: '2026-06-01',
          periodEnd: '2026-06-30',
          warnings: [],
          total_conversations: 50,
          total_messages: 200,
          active_days: 15,
          models_identified: ['gpt-4o'],
          estimated_relative_cost_usd: 2.5,
          daily_conversation_activity: [
            { date: '2026-06-01', conversation_count: 3 },
            { date: '2026-06-15', conversation_count: 5 },
          ],
          estimated_token_volume: 50000,
          trend: { status: 'insufficient_data', observed_days: 15, required_days: 30, message: 'Insufficient data' },
          spike_callout: null,
        },
      },
    ];

    const res = await fetch(`${baseUrl}/api/analyze/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources }),
    });
    expect(res.status).toBe(200);
    const report = await res.json() as AnalysisReport;
    expect(report.sources).toHaveLength(1);
    expect(report.cross_source_summary).toBeDefined();
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(Array.isArray(report.assumptions)).toBe(true);
  });

  it('POST /api/analyze/recommendations returns cross_source_summary.top_recommendations', async () => {
    const sources: SourceReport[] = [
      {
        source_id: 'anthropic',
        tier: 'B',
        connected: true,
        error: null,
        metrics: {
          sourceId: 'anthropic',
          tier: 'B',
          periodStart: '2026-06-01',
          periodEnd: '2026-06-30',
          warnings: [],
          totalInputTokensAnthropic: 150_000,
          cacheCreationInputTokensAnthropic: 0,
          projectedR1SavingsUsd: 12.34,
          totalActualSpendUsd: 20,
          totalSpendUsd: 20,
        },
      },
    ];

    const res = await fetch(`${baseUrl}/api/analyze/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources }),
    });
    expect(res.status).toBe(200);
    const report = await res.json() as AnalysisReport;
    expect(report.cross_source_summary.top_recommendations).toEqual([
      expect.objectContaining({
        id: 'R1',
        source_id: 'anthropic',
        target_card_anchor: '#tool-card-anthropic',
        target_recommendation_anchor: '#rec-anthropic-R1',
        estimated_savings_usd: 12.34,
      }),
    ]);
  });

  it('assumptions text includes ChatGPT estimate caveat (not deferred message)', async () => {
    const sources: SourceReport[] = [];
    const res = await fetch(`${baseUrl}/api/analyze/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources }),
    });
    expect(res.status).toBe(200);
    const report = await res.json() as AnalysisReport;
    const assumptions = report.assumptions ?? [];

    // Must include a ChatGPT estimate caveat (not the old "deferred" text)
    const hasChatGptCaveat = assumptions.some(a =>
      a.toLowerCase().includes('chatgpt') && (
        a.toLowerCase().includes('estimate') ||
        a.toLowerCase().includes('baseline model')
      )
    );
    expect(hasChatGptCaveat).toBe(true);

    // Must NOT say ChatGPT is "deferred"
    const hasDeferred = assumptions.some(a =>
      a.toLowerCase().includes('chatgpt') && a.toLowerCase().includes('deferred')
    );
    expect(hasDeferred).toBe(false);
  });

  it('assumptions text includes Claude export disabled message', async () => {
    const sources: SourceReport[] = [];
    const res = await fetch(`${baseUrl}/api/analyze/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources }),
    });
    expect(res.status).toBe(200);
    const report = await res.json() as AnalysisReport;
    const assumptions = report.assumptions ?? [];

    const hasClaudeDisabled = assumptions.some(a =>
      a.toLowerCase().includes('claude') && (
        a.toLowerCase().includes('disabled') ||
        a.toLowerCase().includes('not available')
      )
    );
    expect(hasClaudeDisabled).toBe(true);
  });

  // ── A4: server-side date-window validation ────────────────────────────────
  it('returns 400 when endDate is in the future', async () => {
    const today = new Date();
    const future = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10)
      .toISOString().split('T')[0];
    const res = await fetch(`${baseUrl}/api/analyze/openai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-01-01', endDate: future }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/future/i);
  });

  it('returns 400 when startDate is after endDate', async () => {
    const res = await fetch(`${baseUrl}/api/analyze/openai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-05-20', endDate: '2026-05-01' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/on or before/i);
  });

  it('returns 400 when any source has invalid analysis window', async () => {
    const today = new Date();
    const future = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10)
      .toISOString().split('T')[0];
    const formData = new FormData();
    formData.append('config', JSON.stringify({
      sources: [
        { sourceId: 'openai', hasCredential: true, startDate: '2026-01-01', endDate: '2026-01-31' },
        { sourceId: 'anthropic', hasCredential: true, startDate: '2026-01-01', endDate: future },
      ],
    }));
    const res = await fetch(`${baseUrl}/api/analyze`, { method: 'POST', body: formData });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/anthropic/i);
  });

  it('preserves adapter warnings on SourceReport when tier is null', async () => {
    const emptyDir = join(tmpdir(), `copilot-warn-${Date.now()}`);
    mkdirSync(emptyDir, { recursive: true });
    process.env.COPILOT_SESSION_STATE_DIR = emptyDir;
    try {
      const res = await fetch(`${baseUrl}/api/analyze/github_copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const report = await res.json() as SourceReport;
      expect(report.tier).toBeNull();
      expect(Array.isArray(report.warnings)).toBe(true);
      expect((report.warnings ?? []).length).toBeGreaterThan(0);
    } finally {
      delete process.env.COPILOT_SESSION_STATE_DIR;
      rmSync(emptyDir, { recursive: true, force: true });
    }
  }, 15_000);
});
