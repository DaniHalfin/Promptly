import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fsPromises from 'node:fs/promises';
import {
  loadPriceMap,
  getPriceMapMeta,
  stopBackgroundRevalidation,
  resetForTesting,
} from '../src/data/priceMap.js';

vi.mock('node:fs/promises');
const mockReadFile = vi.mocked(fsPromises.readFile);

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const MOCK_PRICE_DATA = {
  'gpt-5.4':      { input_cost_per_token: 0.000005, output_cost_per_token: 0.000015 },
  'gpt-5.4-mini': { input_cost_per_token: 0.0000005, output_cost_per_token: 0.0000015 },
};
const UPDATED_PRICE_DATA = {
  'gpt-5.6-sol': { input_cost_per_token: 0.000003, output_cost_per_token: 0.000009 },
};

function onlineFetch(data = MOCK_PRICE_DATA) {
  return mockFetch.mockResolvedValueOnce({ ok: true, json: async () => data });
}
function offlineFetch() {
  return mockFetch.mockRejectedValueOnce(new Error('network error'));
}
function noSidecar() {
  const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  mockReadFile.mockRejectedValueOnce(err);
}
function sidecarWith(fetchedAt: string, modelCount = 100) {
  mockReadFile.mockResolvedValueOnce(JSON.stringify({ fetchedAt, modelCount }) as any);
}

beforeEach(() => { resetForTesting(); vi.clearAllMocks(); });
afterEach(() => { resetForTesting(); });

describe('Group A — cold start', () => {
  it('online success: loads from fetch, source=github-fetch, modelCount correct', async () => {
    onlineFetch(); noSidecar();
    const map = await loadPriceMap();
    expect(map.size).toBe(2);
    expect(getPriceMapMeta().source).toBe('github-fetch');
    expect(getPriceMapMeta().modelCount).toBe(2);
  });

  it('fetch throws → falls back to bundled snapshot, source=bundled-snapshot', async () => {
    offlineFetch(); noSidecar();
    await loadPriceMap();
    expect(getPriceMapMeta().source).toBe('bundled-snapshot');
  });

  it('fetch non-OK (503) → falls back to bundled snapshot', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 }); noSidecar();
    await loadPriceMap();
    expect(getPriceMapMeta().source).toBe('bundled-snapshot');
  });

  it('second call returns cached map; fetch called exactly once', async () => {
    onlineFetch(); noSidecar();
    await loadPriceMap();
    await loadPriceMap();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('resetForTesting clears cache; next call fetches again', async () => {
    onlineFetch(); noSidecar();
    await loadPriceMap();
    resetForTesting();
    onlineFetch(); noSidecar();
    await loadPriceMap();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('Group B — background revalidation', () => {
  it('fires after 24 h; cache and lastRevalidatedAt are updated', async () => {
    vi.useFakeTimers();
    onlineFetch(MOCK_PRICE_DATA); noSidecar();
    onlineFetch(UPDATED_PRICE_DATA);
    await loadPriceMap();
    expect(getPriceMapMeta().lastRevalidatedAt).toBeUndefined();
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(getPriceMapMeta().lastRevalidatedAt).toBeDefined();
    const map = await loadPriceMap();
    expect(map.has('gpt-5.6-sol')).toBe(true);
    vi.useRealTimers();
  });

  it('revalidation failure keeps existing cache; lastRevalidatedAt stays absent', async () => {
    vi.useFakeTimers();
    onlineFetch(MOCK_PRICE_DATA); noSidecar();
    offlineFetch();
    await loadPriceMap();
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    const map = await loadPriceMap();
    expect(map.has('gpt-5.4')).toBe(true);
    expect(getPriceMapMeta().lastRevalidatedAt).toBeUndefined();
    vi.useRealTimers();
  });

  it('NOT scheduled after snapshot fallback (offline cold start)', async () => {
    const intervalSpy = vi.spyOn(globalThis, 'setInterval');
    offlineFetch(); noSidecar();
    await loadPriceMap();
    expect(intervalSpy).not.toHaveBeenCalled();
    intervalSpy.mockRestore();
  });

  it('stopBackgroundRevalidation cancels the timer', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    onlineFetch(); noSidecar();
    await loadPriceMap();
    stopBackgroundRevalidation();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('timer.unref() is called on the interval handle (prevents process hang)', async () => {
    const fakeTimer = { unref: vi.fn() };
    const intervalSpy = vi.spyOn(globalThis, 'setInterval').mockReturnValueOnce(fakeTimer as any);
    onlineFetch(); noSidecar();
    await loadPriceMap();
    expect(fakeTimer.unref).toHaveBeenCalledTimes(1);
    intervalSpy.mockRestore();
  });
});

describe('Group C — metadata', () => {
  it('correct fields after online cold start (no sidecar → snapshotAgeDays=null)', async () => {
    onlineFetch(); noSidecar();
    await loadPriceMap();
    const meta = getPriceMapMeta();
    expect(meta.source).toBe('github-fetch');
    expect(meta.modelCount).toBe(2);
    expect(typeof meta.loadedAt).toBe('string');
    expect(meta.snapshotAgeDays).toBeNull();
    expect(meta.lastRevalidatedAt).toBeUndefined();
  });

  it('source=bundled-snapshot after offline cold start', async () => {
    offlineFetch(); noSidecar();
    await loadPriceMap();
    expect(getPriceMapMeta().source).toBe('bundled-snapshot');
  });

  it('lastRevalidatedAt is set only after revalidation fires', async () => {
    vi.useFakeTimers();
    onlineFetch(MOCK_PRICE_DATA); noSidecar();
    onlineFetch(MOCK_PRICE_DATA);
    await loadPriceMap();
    expect(getPriceMapMeta().lastRevalidatedAt).toBeUndefined();
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(getPriceMapMeta().lastRevalidatedAt).toBeDefined();
    vi.useRealTimers();
  });

  it('snapshotAgeDays=0 when sidecar fetchedAt is today', async () => {
    onlineFetch();
    sidecarWith(new Date().toISOString(), 100);
    await loadPriceMap();
    expect(getPriceMapMeta().snapshotAgeDays).toBe(0);
  });

  it('snapshotAgeDays=15 when sidecar fetchedAt is 15 days ago', async () => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    onlineFetch();
    sidecarWith(fifteenDaysAgo, 100);
    await loadPriceMap();
    expect(getPriceMapMeta().snapshotAgeDays).toBe(15);
  });
});
