/**
 * Phase 3 Unit E1 — apiClient.validate contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, normalizeErrorMessage } from '../src/api/client';

describe('FIX-7: normalizeErrorMessage', () => {
  it('returns safe fallback for null/undefined/empty', () => {
    expect(normalizeErrorMessage(null)).toBe('An unknown error occurred.');
    expect(normalizeErrorMessage(undefined)).toBe('An unknown error occurred.');
    expect(normalizeErrorMessage('')).toBe('An unknown error occurred.');
  });

  it('passes through safe single-line messages unchanged', () => {
    expect(normalizeErrorMessage('No data available for this period')).toBe(
      'No data available for this period'
    );
  });

  it('strips multi-line stack traces — returns only first line', () => {
    const stack = 'Error: Cannot read property\n    at Object.<anonymous> (/server/routes/analyze.ts:42:10)\n    at Module._compile (node:internal/modules/cjs/loader:1376:14)';
    const result = normalizeErrorMessage(stack);
    expect(result).not.toContain('at Object');
    expect(result).not.toContain('node:internal');
    expect(result).toBe('Cannot read property');
  });

  it('strips "Error:" prefix from first line', () => {
    expect(normalizeErrorMessage('Error: Internal server error')).toBe('Internal server error');
  });

  it('strips inline stack-trace patterns', () => {
    const msg = 'Something broke at Object.fn (index.js:12:5)';
    expect(normalizeErrorMessage(msg)).not.toContain('(index.js:12:5)');
  });

  it('Error.tsx must not render raw Error.message without normalization', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const errorSrc = readFileSync(resolve(__dirname, '../src/pages/Error.tsx'), 'utf-8');
    const analysisSrc = readFileSync(resolve(__dirname, '../src/pages/Analysis.tsx'), 'utf-8');
    // Analysis.tsx must apply normalizeErrorMessage before dispatching analysisError
    expect(analysisSrc).toContain('normalizeErrorMessage(');
    // Error.tsx must not directly dereference .message or .stack
    expect(errorSrc).not.toMatch(/error\.message|error\.stack/);
  });

  // CG-1: edge cases for double-prefix, bare "Error:", and whitespace-only input
  it('CG-1: strips only the outermost "Error:" prefix (does not double-strip)', () => {
    // normalizeErrorMessage('Error: Error: something') strips the first 'Error: '
    // and returns 'Error: something' — only one pass of prefix stripping.
    const result = normalizeErrorMessage('Error: Error: something');
    // First "Error: " is stripped; "Error: something" is the remainder
    expect(result).toBe('Error: something');
    // The original input is not returned unchanged
    expect(result).not.toBe('Error: Error: something');
    // Content after both prefixes is still present
    expect(result).toContain('something');
  });

  it('CG-1: bare "Error:" alone returns safe fallback', () => {
    // "Error:" with nothing after the colon → stripped to empty string → fallback
    const result = normalizeErrorMessage('Error:');
    // The source code fallback for an empty string after prefix strip is 'An unexpected error occurred.'
    expect(result).toMatch(/An (unknown|unexpected) error occurred\./);
  });

  it('CG-1: whitespace-only string returns safe fallback', () => {
    // Non-empty but all-whitespace → trim() produces empty string → fallback
    expect(normalizeErrorMessage('   ')).toMatch(/An (unknown|unexpected) error occurred\./);
    expect(normalizeErrorMessage('\t\n')).toMatch(/An (unknown|unexpected) error occurred\./);
  });
});

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

describe('apiClient.validate — network failure paths — CG-3', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('CG-3: throws a normalized error string on TypeError (network failure)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch')
    );

    await expect(apiClient.validate('openai', '2026-01-01', '2026-03-01'))
      .rejects.toThrow(/Failed to fetch|network|unknown/i);
  });

  it('CG-3: throws when server returns HTTP 500 with HTML error page', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        '<html><body>Internal Server Error</body></html>',
        { status: 500, headers: { 'Content-Type': 'text/html' } },
      ) as unknown as Response,
    );

    await expect(apiClient.validate('openai', '2026-01-01', '2026-03-01'))
      .rejects.toThrow();
  });
});
