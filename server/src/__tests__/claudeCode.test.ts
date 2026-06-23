import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import claudeCodeAdapter, { isPeakHour } from '../adapters/claudeCode.js';
import type { PriceMap } from '../data/priceMap.js';

let previousClaudeConfigDir: string | undefined;
let tempDirs: string[] = [];

afterEach(async () => {
  if (previousClaudeConfigDir === undefined) {
    delete process.env.CLAUDE_CONFIG_DIR;
  } else {
    process.env.CLAUDE_CONFIG_DIR = previousClaudeConfigDir;
  }
  previousClaudeConfigDir = undefined;

  await Promise.all(tempDirs.map(dir => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

describe('Claude Code adapter helpers', () => {
  it.each([
    ['Monday 09:00 UTC', '2026-06-15T09:00:00Z', true],
    ['Monday 09:00+07:00 is 02:00 UTC', '2026-06-15T09:00:00+07:00', false],
    ['Monday 08:00 UTC boundary inclusive', '2026-06-15T08:00:00Z', true],
    ['Monday 18:00 UTC boundary exclusive', '2026-06-15T18:00:00Z', false],
    ['Saturday 10:00 UTC', '2026-06-20T10:00:00Z', false],
    ['Sunday 12:00 UTC', '2026-06-21T12:00:00Z', false],
    ['Z suffix timestamp', '2026-06-16T09:00:00Z', true],
    ['no offset timestamp treated as UTC', '2026-06-16T09:00:00', true],
    ['invalid timestamp', 'not-a-date', false],
  ])('%s -> %s', (_label, timestamp, expected) => {
    expect(isPeakHour(timestamp)).toBe(expected);
  });

  it('counts parsed JSONL files as Claude Code sessions', async () => {
    previousClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
    const root = await mkdtemp(path.join(os.tmpdir(), 'promptly-claude-code-'));
    tempDirs.push(root);
    process.env.CLAUDE_CONFIG_DIR = root;

    const projectDir = path.join(root, 'projects', 'sample');
    await mkdir(projectDir, { recursive: true });
    const sessionLine = (timestamp: string) => JSON.stringify({
      timestamp,
      model: 'claude-test',
      usage: { input_tokens: 100, output_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    });
    await writeFile(path.join(projectDir, 'one.jsonl'), `${sessionLine('2026-06-15T09:00:00Z')}\n`);
    await writeFile(path.join(projectDir, 'two.jsonl'), `${sessionLine('2026-06-15T19:00:00Z')}\n`);

    const priceMap: PriceMap = new Map([[
      'claude-test',
      { input_cost_per_token: 0.001, output_cost_per_token: 0.002 },
    ]]);

    await expect(claudeCodeAdapter.validate({ priceMap })).resolves.toMatchObject({ valid: true });
    const result = await claudeCodeAdapter.run({ priceMap });

    expect(result.connected).toBe(true);
    expect(result.raw?.sessionCount).toBe(2);
    expect(result.raw?.claudeCodePeakHourFraction).toBe(0.5);
  });
});
