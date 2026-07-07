/**
 * adapterValidateContract.test.ts — Batch 1 (Unit 1c).
 *
 * Asserts the discriminated-union contract of SourceAdapter.validate():
 *   - valid: true  → `daysAvailable` is a defined, non-negative number and `error` is null.
 *   - valid: false → `error` is present and `daysAvailable` is absent.
 *
 * Covers all four/five source adapters (OpenAI, Anthropic, GitHub Copilot,
 * Claude Code, ChatGPT Export). Network adapters (OpenAI/Anthropic) have their
 * HTTP client mocked so no real credentials or network access are used.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { PriceMap } from '../src/data/priceMap.js';

// Mock the shared HTTP client so OpenAI/Anthropic validate() succeed offline.
vi.mock('../src/lib/httpClient.js', () => ({
  httpGet: vi.fn(async () => ({ data: [] })),
  httpWithRetry: vi.fn(async () => ({ data: [] })),
}));

const priceMap: PriceMap = new Map();

/** Narrow the validate() result and assert the union invariants. */
function assertValidWithDays(result: { valid: boolean; error: unknown; daysAvailable?: number }) {
  expect(result.valid).toBe(true);
  expect(result.error).toBeNull();
  expect(typeof result.daysAvailable).toBe('number');
  expect(Number.isFinite(result.daysAvailable)).toBe(true);
  expect(result.daysAvailable as number).toBeGreaterThanOrEqual(0);
}

describe('adapter validate() contract — discriminated union', () => {
  describe('OpenAI', () => {
    it('returns valid:true with a positive daysAvailable when the API responds', async () => {
      const { default: openaiAdapter } = await import('../src/adapters/openai.js');
      const result = await openaiAdapter.validate({ credential: 'sk-test', priceMap });
      assertValidWithDays(result);
      expect(result.daysAvailable).toBeGreaterThan(0);
    });

    it('returns valid:false with error (no daysAvailable) when credential is missing', async () => {
      const { default: openaiAdapter } = await import('../src/adapters/openai.js');
      const result = await openaiAdapter.validate({ priceMap });
      expect(result.valid).toBe(false);
      expect(result.error).not.toBeNull();
      expect(result.daysAvailable).toBeUndefined();
    });
  });

  describe('Anthropic', () => {
    it('returns valid:true with a positive daysAvailable when the API responds', async () => {
      const { default: anthropicAdapter } = await import('../src/adapters/anthropic.js');
      const result = await anthropicAdapter.validate({ credential: 'sk-ant-test', priceMap });
      assertValidWithDays(result);
      expect(result.daysAvailable).toBeGreaterThan(0);
    });

    it('returns valid:false with error (no daysAvailable) when credential is missing', async () => {
      const { default: anthropicAdapter } = await import('../src/adapters/anthropic.js');
      const result = await anthropicAdapter.validate({ priceMap });
      expect(result.valid).toBe(false);
      expect(result.error).not.toBeNull();
      expect(result.daysAvailable).toBeUndefined();
    });
  });

  describe('ChatGPT Export', () => {
    it('returns valid:true with a defined daysAvailable (rolling-window default)', async () => {
      const { default: chatgptExportAdapter } = await import('../src/adapters/chatgptExport.js');
      const result = await chatgptExportAdapter.validate({ priceMap });
      assertValidWithDays(result);
      expect(result.daysAvailable).toBeGreaterThan(0);
    });
  });

  describe('GitHub Copilot', () => {
    let saved: string | undefined;
    const tempDirs: string[] = [];

    beforeEach(() => { saved = process.env.COPILOT_SESSION_STATE_DIR; });
    afterEach(async () => {
      if (saved === undefined) delete process.env.COPILOT_SESSION_STATE_DIR;
      else process.env.COPILOT_SESSION_STATE_DIR = saved;
      await Promise.all(tempDirs.map(d => rm(d, { recursive: true, force: true })));
      tempDirs.length = 0;
    });

    it('returns valid:true and counts distinct days of session data', async () => {
      const { default: githubCopilotAdapter } = await import('../src/adapters/githubCopilot.js');
      const root = await mkdtemp(path.join(os.tmpdir(), 'promptly-copilot-days-'));
      tempDirs.push(root);
      process.env.COPILOT_SESSION_STATE_DIR = root;

      const sessionDir = path.join(root, 'session-1');
      await mkdir(sessionDir);
      const event = (iso: string) => JSON.stringify({
        type: 'session.shutdown',
        data: { sessionStartTime: new Date(iso).getTime(), totalPremiumRequests: 1, modelMetrics: {} },
      });
      // Two distinct local calendar days (noon UTC avoids TZ boundary flips).
      await writeFile(
        path.join(sessionDir, 'events.jsonl'),
        `${event('2026-06-15T12:00:00Z')}\n${event('2026-06-16T12:00:00Z')}\n`,
        'utf-8',
      );

      const result = await githubCopilotAdapter.validate({ priceMap });
      assertValidWithDays(result);
      expect(result.daysAvailable).toBe(2);
    });

    it('returns valid:true with daysAvailable:0 for a connected-but-empty session dir', async () => {
      const { default: githubCopilotAdapter } = await import('../src/adapters/githubCopilot.js');
      const root = await mkdtemp(path.join(os.tmpdir(), 'promptly-copilot-empty-'));
      tempDirs.push(root);
      process.env.COPILOT_SESSION_STATE_DIR = root;

      const result = await githubCopilotAdapter.validate({ priceMap });
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
      expect(result.daysAvailable).toBe(0);
    });

    it('returns valid:false with error (no daysAvailable) when dir is missing', async () => {
      const { default: githubCopilotAdapter } = await import('../src/adapters/githubCopilot.js');
      const root = await mkdtemp(path.join(os.tmpdir(), 'promptly-copilot-missing-'));
      tempDirs.push(root);
      process.env.COPILOT_SESSION_STATE_DIR = path.join(root, 'nope');

      const result = await githubCopilotAdapter.validate({ priceMap });
      expect(result.valid).toBe(false);
      expect(result.error).not.toBeNull();
      expect(result.daysAvailable).toBeUndefined();
    });
  });

  describe('Claude Code', () => {
    let saved: string | undefined;
    const tempDirs: string[] = [];

    beforeEach(() => { saved = process.env.CLAUDE_CONFIG_DIR; });
    afterEach(async () => {
      if (saved === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = saved;
      await Promise.all(tempDirs.map(d => rm(d, { recursive: true, force: true })));
      tempDirs.length = 0;
    });

    it('returns valid:true and counts distinct days of session records', async () => {
      const { default: claudeCodeAdapter } = await import('../src/adapters/claudeCode.js');
      const root = await mkdtemp(path.join(os.tmpdir(), 'promptly-claude-days-'));
      tempDirs.push(root);
      process.env.CLAUDE_CONFIG_DIR = root;

      const projectDir = path.join(root, 'projects', 'sample');
      await mkdir(projectDir, { recursive: true });
      const line = (iso: string) => JSON.stringify({
        timestamp: iso,
        model: 'claude-test',
        usage: { input_tokens: 100, output_tokens: 10 },
      });
      await writeFile(
        path.join(projectDir, 's.jsonl'),
        `${line('2026-06-15T09:00:00Z')}\n${line('2026-06-16T09:00:00Z')}\n${line('2026-06-16T18:00:00Z')}\n`,
        'utf-8',
      );

      const result = await claudeCodeAdapter.validate({ priceMap });
      assertValidWithDays(result);
      expect(result.daysAvailable).toBe(2); // 06-15 and 06-16 (two records same day counts once)
    });

    it('returns valid:true with daysAvailable:0 for a connected-but-empty projects dir', async () => {
      const { default: claudeCodeAdapter } = await import('../src/adapters/claudeCode.js');
      const root = await mkdtemp(path.join(os.tmpdir(), 'promptly-claude-empty-'));
      tempDirs.push(root);
      process.env.CLAUDE_CONFIG_DIR = root;
      await mkdir(path.join(root, 'projects'), { recursive: true });

      const result = await claudeCodeAdapter.validate({ priceMap });
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
      expect(result.daysAvailable).toBe(0);
    });

    it('returns valid:false with error (no daysAvailable) when projects dir is missing', async () => {
      const { default: claudeCodeAdapter } = await import('../src/adapters/claudeCode.js');
      const root = await mkdtemp(path.join(os.tmpdir(), 'promptly-claude-missing-'));
      tempDirs.push(root);
      process.env.CLAUDE_CONFIG_DIR = path.join(root, 'nope');

      const result = await claudeCodeAdapter.validate({ priceMap });
      expect(result.valid).toBe(false);
      expect(result.error).not.toBeNull();
      expect(result.daysAvailable).toBeUndefined();
    });
  });
});
