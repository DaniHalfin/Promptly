/**
 * priceMapRoute.test.ts
 *
 * HTTP integration tests for GET /api/price-map/meta.
 * Verifies the route correctly serialises getPriceMapMeta() output — including
 * snapshotAgeDays and lastRevalidatedAt — as JSON.
 *
 * Mock strategy:
 *   - vi.mock('../src/data/priceMap.js') mocks the entire module so getPriceMapMeta
 *     returns controlled values without any real fetch or filesystem calls.
 *   - No globalThis.fetch stub — the test code's own HTTP calls to the Express
 *     server must use the real fetch. Stubbing globalThis.fetch would intercept them.
 *   - Server lifecycle: createApp() + port-0 in beforeAll/afterAll.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Server } from 'node:http';
import type { Application } from 'express';
import { createApp } from '../src/index.js';
import { getPriceMapMeta } from '../src/data/priceMap.js';

vi.mock('../src/data/priceMap.js');
const mockGetMeta = vi.mocked(getPriceMapMeta);

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/price-map/meta', () => {
  it('returns snapshotAgeDays=15 when meta reports 15-day-old snapshot', async () => {
    mockGetMeta.mockReturnValue({
      loadedAt: new Date().toISOString(),
      source: 'github-fetch',
      modelCount: 100,
      sourceDate: undefined,
      lastRevalidatedAt: undefined,
      snapshotAgeDays: 15,
    });

    const res = await fetch(`${baseUrl}/api/price-map/meta`);
    expect(res.status).toBe(200);
    const meta = await res.json() as Record<string, unknown>;
    expect(meta.snapshotAgeDays).toBe(15);
    expect(meta.source).toBe('github-fetch');
    expect(meta.lastRevalidatedAt).toBeNull(); // undefined → null via ?? null in route
  });

  it('returns lastRevalidatedAt when set; null when absent', async () => {
    const revalidatedAt = new Date().toISOString();
    mockGetMeta.mockReturnValue({
      loadedAt: new Date().toISOString(),
      source: 'github-fetch',
      modelCount: 100,
      sourceDate: undefined,
      lastRevalidatedAt: revalidatedAt,
      snapshotAgeDays: 0,
    });

    const res = await fetch(`${baseUrl}/api/price-map/meta`);
    expect(res.status).toBe(200);
    const meta = await res.json() as Record<string, unknown>;
    expect(meta.lastRevalidatedAt).toBe(revalidatedAt);
    expect(meta.snapshotAgeDays).toBe(0);
  });
});
