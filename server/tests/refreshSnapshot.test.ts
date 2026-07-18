import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fsPromises from 'node:fs/promises';
import { run } from '../scripts/refresh-snapshot.js';

vi.mock('node:fs/promises');
const mockWriteFile = vi.mocked(fsPromises.writeFile);

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const VALID_SNAPSHOT = {
  'gpt-4o':      { input_cost_per_token: 0.000005, output_cost_per_token: 0.000015 },
  'gpt-5.6-sol': { input_cost_per_token: 0.000003, output_cost_per_token: 0.000009 },
  'not-a-model': 'string — should not be counted',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteFile.mockResolvedValue(undefined as any);
});

describe('refresh-snapshot run()', () => {
  it('writes valid JSON to the snapshot path', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => VALID_SNAPSHOT });
    await run();
    const snapshotCall = mockWriteFile.mock.calls.find(
      ([p]) => (p as string).includes('model_prices_and_context_window.json'),
    );
    expect(snapshotCall).toBeDefined();
    const written = JSON.parse(snapshotCall![1] as string);
    expect(written['gpt-4o'].input_cost_per_token).toBe(0.000005);
    expect(written['gpt-5.6-sol']).toBeDefined();
  });

  it('writes snapshot-meta.json with correct fetchedAt and modelCount', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => VALID_SNAPSHOT });
    const before = Date.now();
    await run();
    const after = Date.now();
    const metaCall = mockWriteFile.mock.calls.find(
      ([p]) => (p as string).includes('snapshot-meta.json'),
    );
    expect(metaCall).toBeDefined();
    const meta = JSON.parse(metaCall![1] as string) as { fetchedAt: string; modelCount: number };
    expect(meta.modelCount).toBe(2);
    const fetchedAtMs = new Date(meta.fetchedAt).getTime();
    expect(fetchedAtMs).toBeGreaterThanOrEqual(before);
    expect(fetchedAtMs).toBeLessThanOrEqual(after);
  });

  it('rejects when fetch throws; no files written', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(run()).rejects.toThrow('ECONNREFUSED');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('rejects when fetch returns non-OK; no files written', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(run()).rejects.toThrow(/HTTP 503/);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});
