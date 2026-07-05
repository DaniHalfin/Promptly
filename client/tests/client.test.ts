/**
 * Phase 3 Unit E1 — apiClient.validate contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from '../src/api/client';

describe('apiClient.validate', () => {
  beforeEach(() => {
    apiClient.clearCredentials();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends startDate and endDate in body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ valid: true, sourceId: 'openai', availability: 'full', daysAvailable: 60, daysRequested: 60, warnings: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ) as unknown as Response,
    );

    await apiClient.validate('openai', '2026-01-01', '2026-03-01');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.startDate).toBe('2026-01-01');
    expect(body.endDate).toBe('2026-03-01');
  });

  it('returns structured no-data result without losing errorMessage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ valid: false, sourceId: 'anthropic', availability: 'none', daysAvailable: 0, daysRequested: 60, errorMessage: 'No data in selected range' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ) as unknown as Response,
    );

    const result = await apiClient.validate('anthropic', '2026-01-01', '2026-03-01');

    // Structured no-data response is returned, not thrown.
    expect(result.valid).toBe(false);
    expect(result.availability).toBe('none');
    expect(result.daysAvailable).toBe(0);
    expect(result.daysRequested).toBe(60);
    expect(result.errorMessage).toBe('No data in selected range');
  });

  it('derives partial availability when server omits the availability field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ valid: true, sourceId: 'openai', daysAvailable: 18, daysRequested: 60 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ) as unknown as Response,
    );

    const result = await apiClient.validate('openai', '2026-01-01', '2026-03-01');
    expect(result.availability).toBe('partial');
  });
});
