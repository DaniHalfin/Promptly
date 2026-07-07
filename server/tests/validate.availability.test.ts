/**
 * validate.availability.test.ts — Phase 3 Unit E2.
 *
 * Covers the generic POST /api/sources/:sourceId/validate availability
 * normalization (full/partial/none). The adapter registry is mocked so
 * daysAvailable is deterministic; the route derives availability from the
 * requested range vs. reported coverage.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { Server } from 'node:http';
import type { Application } from 'express';

// Deterministic adapter stubs keyed by source id.
vi.mock('../src/adapters/registry.js', () => ({
  getAdapter: (id: string) => {
    if (id === 'full_src') return { validate: async () => ({ valid: true, error: null, daysAvailable: 999 }) };
    if (id === 'partial_src') return { validate: async () => ({ valid: true, error: null, daysAvailable: 10 }) };
    if (id === 'none_src') return { validate: async () => ({ valid: true, error: null, daysAvailable: 0 }) };
    return undefined;
  },
}));

import { createApp } from '../src/index.js';

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

async function validate(sourceId: string, startDate: string, endDate: string) {
  const res = await fetch(`${baseUrl}/api/sources/${sourceId}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate }),
  });
  const body = await res.json() as {
    valid: boolean; availability?: string; daysAvailable?: number; daysRequested?: number; warnings?: string[]; errorMessage?: string;
  };
  return { status: res.status, body };
}

describe('validate route — availability normalization (E2)', () => {
  it('returns full availability when daysAvailable covers requested range', async () => {
    const { status, body } = await validate('full_src', '2026-01-01', '2026-01-30');
    expect(status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.availability).toBe('full');
    expect(body.daysRequested).toBe(30);
    expect(body.daysAvailable).toBe(999);
  });

  it('returns partial availability and day count when coverage is shorter', async () => {
    const { status, body } = await validate('partial_src', '2026-01-01', '2026-02-09');
    expect(status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.availability).toBe('partial');
    expect(body.daysAvailable).toBe(10);
    expect(body.daysRequested).toBe(40);
    expect(body.warnings && body.warnings[0]).toMatch(/10 of 40 days/);
  });

  it('returns none for no data in selected range', async () => {
    const { status, body } = await validate('none_src', '2026-01-01', '2026-02-09');
    expect(status).toBe(400);
    expect(body.valid).toBe(false);
    expect(body.availability).toBe('none');
    expect(body.daysAvailable).toBe(0);
    expect(body.daysRequested).toBe(40);
    expect(body.errorMessage).toMatch(/No data/i);
  });

  // Batch 1 (1c): discriminated-union footgun guard. An adapter that returns the
  // fully-typed valid result `{ valid: true, error: null, daysAvailable: 0 }`
  // must be normalized to availability: 'none' by the route — proving the old
  // `daysAvailable ?? 0` fallback can no longer mask a zero-coverage source now
  // that the type requires daysAvailable on every valid result.
  it('maps a valid-but-zero-coverage adapter result to availability none', async () => {
    const { status, body } = await validate('none_src', '2026-03-01', '2026-03-31');
    expect(status).toBe(400);
    expect(body.valid).toBe(false);
    expect(body.availability).toBe('none');
    expect(body.daysAvailable).toBe(0);
    expect(body.daysRequested).toBeGreaterThan(0);
  });
});
