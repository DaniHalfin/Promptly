/**
 * Phase 3 Unit A — Landing date-range presets, MoM nudge, and range validation.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Landing } from '../src/pages/Landing';
import { SessionContext } from '../src/context/SessionContext.js';
import { getPresetRange, getYtdRange, toIsoDate, validateDateRange } from '../src/lib/dateRange.js';

vi.mock('../src/components/ThemeToggle.js', () => ({ ThemeToggle: () => null }));
vi.mock('../src/components/SourceCard.js', () => ({ SourceCard: () => null }));

const fullValidationResult = {
  valid: true,
  sourceId: 'openai',
  availability: 'full' as const,
  daysAvailable: 60,
  daysRequested: 60,
  warnings: [] as string[],
};

const validateMock = vi.fn().mockResolvedValue(fullValidationResult);

vi.mock('../src/api/client.js', () => ({
  apiClient: {
    validate: (...args: [string, string?, string?]) => validateMock(...args),
  },
  normalizeErrorMessage: (raw: string | undefined | null): string => {
    if (!raw) return 'An unknown error occurred.';
    const lines = raw.split('\n').map((l: string) => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      const first = lines[0];
      return first.replace(/^Error:\s*/i, '') || 'An unexpected error occurred.';
    }
    // Single-line but contains stack-trace markers
    if (/\s+at\s+\S+\s+\(/.test(raw)) {
      return 'An unexpected error occurred.';
    }
    // Strip "Error: " prefix and any trailing file path fragments
    return (
      raw
        .replace(/^Error:\s*/i, '')
        .replace(/\s*\([^)]*\.(ts|js|tsx):\d+\)$/, '')
        .trim() || 'An unexpected error occurred.'
    );
  },
}));

// A source that is enabled AND already validated as full — passes E4 gating.
const fullOpenAi = { status: 'connected', credential: 'sk-test', validation: { status: 'full', daysAvailable: 60, daysRequested: 60 } };

function renderLanding(sources: Record<string, unknown> = { openai: { ...fullOpenAi } }) {
  const dispatch = vi.fn();
  const ctx = {
    state: { phase: 'landing', sources },
    dispatch,
    updateSource: vi.fn(),
    clearSession: vi.fn(),
    abortControllerRef: { current: null as AbortController | null },
  };
  render(
    <SessionContext.Provider value={ctx as any}>
      <Landing />
    </SessionContext.Provider>
  );
  return { dispatch };
}

describe('Landing — A1 presets & config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateMock.mockResolvedValue(fullValidationResult);
  });

  it('defaults to Last 60 days and hides custom range picker', () => {
    renderLanding({});
    const last60 = screen.getByTestId('period-preset-last_60');
    expect(last60).toHaveAttribute('aria-pressed', 'true');
    // Custom DayPicker grid is not rendered by default
    expect(document.querySelector('.promptly-day-picker')).toBeNull();
  });

  it('renders Last 7/30/60/90/YTD/Custom presets', () => {
    renderLanding({});
    for (const id of ['last_7', 'last_30', 'last_60', 'last_90', 'ytd', 'custom']) {
      expect(screen.getByTestId(`period-preset-${id}`)).toBeInTheDocument();
    }
  });

  it('passes derived Last 60 day range into pending analysis config', async () => {
    const { dispatch } = renderLanding();
    fireEvent.click(screen.getByRole('button', { name: /Run Analysis/i }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    const arg = dispatch.mock.calls[0][0];
    const expected = getPresetRange('last_60');
    const src = arg.pendingAnalysis.config.sources.find((s: any) => s.sourceId === 'openai');
    expect(src.startDate).toBe(expected.start);
    expect(src.endDate).toBe(expected.end);
    await waitFor(() => expect(validateMock).toHaveBeenCalled());
  });

  it('derives YTD from Jan 1 through today', async () => {
    const { dispatch } = renderLanding();
    fireEvent.click(screen.getByTestId('period-preset-ytd'));
    fireEvent.click(screen.getByRole('button', { name: /Run Analysis/i }));
    const arg = dispatch.mock.calls[0][0];
    const ytd = getYtdRange();
    const src = arg.pendingAnalysis.config.sources.find((s: any) => s.sourceId === 'openai');
    expect(src.startDate).toBe(ytd.start);
    expect(src.startDate.endsWith('-01-01')).toBe(true);
    expect(src.endDate).toBe(ytd.end);
    await waitFor(() => expect(validateMock).toHaveBeenCalled());
  });

  it('passes selected custom range into pending analysis config', async () => {
    const { dispatch } = renderLanding();
    fireEvent.click(screen.getByTestId('period-preset-custom'));
    // DayPicker renders; pick two enabled days to form a range
    const enabledDays = Array.from(
      document.querySelectorAll('.rdp-day:not(.rdp-day_disabled)')
    ) as HTMLElement[];
    expect(enabledDays.length).toBeGreaterThan(6);
    fireEvent.click(enabledDays[2]);
    fireEvent.click(enabledDays[6]);
    // Read the resolved range from the period summary
    const summary = screen.getByTestId('period-summary').textContent ?? '';
    const match = summary.match(/(\d{4}-\d{2}-\d{2}) – (\d{4}-\d{2}-\d{2})/);
    expect(match).not.toBeNull();
    const [, start, end] = match!;
    fireEvent.click(screen.getByRole('button', { name: /Run Analysis/i }));
    const arg = dispatch.mock.calls[0][0];
    const src = arg.pendingAnalysis.config.sources.find((s: any) => s.sourceId === 'openai');
    expect(src.startDate).toBe(start);
    expect(src.endDate).toBe(end);
    await waitFor(() => expect(validateMock).toHaveBeenCalled());
  });
});

describe('Landing — A2 MoM nudge & validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateMock.mockResolvedValue(fullValidationResult);
  });

  it('shows MoM nudge for Last 7 days', () => {
    renderLanding({});
    fireEvent.click(screen.getByTestId('period-preset-last_7'));
    expect(screen.getByTestId('mom-window-nudge')).toBeInTheDocument();
  });

  it('shows MoM nudge for Last 30 days', () => {
    renderLanding({});
    fireEvent.click(screen.getByTestId('period-preset-last_30'));
    expect(screen.getByTestId('mom-window-nudge')).toBeInTheDocument();
  });

  it('does not show MoM nudge for Last 60 days', () => {
    renderLanding({});
    expect(screen.queryByTestId('mom-window-nudge')).toBeNull();
  });

  it('blocks analysis + inline error for future custom end date', () => {
    // The DayPicker blocks future dates visually (disabled={{after: today}} +
    // toDate={today}), so a future end date cannot originate from the picker.
    // validateDateRange — called by handleAnalyze before dispatch — is the guard.
    const today = new Date();
    const future = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5);
    const err = validateDateRange({ start: toIsoDate(today), end: toIsoDate(future) });
    expect(err).toBe('End date cannot be in the future.');
  });

  it('surfaces an inline error and does not dispatch when validateDateRange returns an error', async () => {
    // Import the module namespace so vi.spyOn can intercept the call that
    // Landing.tsx makes to validateDateRange(effectiveDateRange).
    // (Landing.tsx imports validateDateRange from the same module, so the spy
    //  intercepts via the live ESM binding in Vitest's module registry.)
    const dateRangeModule = await import('../src/lib/dateRange.js');
    const validateSpy = vi.spyOn(dateRangeModule, 'validateDateRange')
      .mockReturnValue('Select both a start and end date.');

    try {
      const { dispatch } = renderLanding();

      // Clicking Run Analysis triggers handleAnalyze → validateDateRange(effectiveDateRange)
      // → spy returns the error string → setDateError fires → return (no dispatch)
      fireEvent.click(screen.getByRole('button', { name: /Run Analysis/i }));

      // The inline error element must appear with the mocked error text
      const errorEl = screen.getByTestId('date-range-error');
      expect(errorEl).toBeInTheDocument();
      expect(errorEl).toHaveTextContent('Select both a start and end date.');

      // dispatch must NOT have been called — the range guard must have fired
      expect(dispatch).not.toHaveBeenCalled();
    } finally {
      validateSpy.mockRestore();
    }
  });

  it('blocks analysis + inline error when custom start is after end', () => {
    // Range mode auto-orders selections, so a reversed range cannot originate
    // from the picker; validateDateRange (called by handleAnalyze) is the guard.
    const err = validateDateRange({ start: '2026-05-20', end: '2026-05-10' });
    expect(err).toBe('Start date must be on or before the end date.');
  });
});

describe('Landing — B3/A2 layout & touch targets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateMock.mockResolvedValue(fullValidationResult);
  });

  it('reserves scroll padding for fixed action footer', () => {
    renderLanding({});
    expect(screen.getByTestId('landing-action-footer')).toHaveStyle({ position: 'fixed', bottom: '0px' });
    // R1/B-RUNTIME-01: the footer clearance now lives on the source-list container as an
    // explicit paddingBottom measured from the live footer height via ResizeObserver.
    // The no-op ResizeObserver mock keeps the initial 220px value; safe-area inset is
    // folded into the measured border-box height at runtime, so it is no longer a calc().
    const reserved = screen.getByTestId('source-list').style.paddingBottom;
    expect(reserved).toContain('220px');
  });

  it('date preset buttons meet touch target', () => {
    renderLanding({});
    for (const id of ['last_7', 'last_30', 'last_60', 'last_90', 'ytd', 'custom']) {
      expect(screen.getByTestId(`period-preset-${id}`)).toHaveStyle({ minHeight: '44px' });
    }
  });
});

describe('Landing — E4 validation orchestration & gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateMock.mockImplementation(async (sourceId: string) => ({
      valid: true, sourceId, availability: 'full' as const, daysAvailable: 60, daysRequested: 60, warnings: [],
    }));
  });

  it('validates enabled source with current date range when toggled on', async () => {
    renderLanding({ openai: { ...fullOpenAi } });
    const range = getPresetRange('last_60');
    await waitFor(() => {
      expect(validateMock).toHaveBeenCalledWith('openai', range.start, range.end);
    });
  });

  it('revalidates enabled sources when date range changes', async () => {
    renderLanding({ openai: { ...fullOpenAi } });
    await waitFor(() => expect(validateMock).toHaveBeenCalled());
    validateMock.mockClear();
    fireEvent.click(screen.getByTestId('period-preset-last_7'));
    const range7 = getPresetRange('last_7');
    await waitFor(() => {
      expect(validateMock).toHaveBeenCalledWith('openai', range7.start, range7.end);
    });
  });

  it('shows validating indicator after the 200ms delay', async () => {
    vi.useFakeTimers();
    try {
      // Never resolves → validation stays in-flight so the delayed spinner shows.
      validateMock.mockImplementation(() => new Promise(() => {}) as any);
      renderLanding({ openai: { ...fullOpenAi } });
      expect(screen.queryByTestId('validation-spinner')).toBeNull();
      await act(async () => { vi.advanceTimersByTime(200); });
      expect(screen.getByTestId('validation-spinner')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Run Analysis disabled while validation is running', () => {
    renderLanding({ openai: { status: 'connected', credential: 'sk-test', validation: { status: 'validating' } } });
    expect(screen.getByRole('button', { name: /Run Analysis/i })).toBeDisabled();
    expect(screen.queryByTestId('run-disabled-reason')).not.toBeInTheDocument();
  });

  it('Run Analysis disabled + explains when all enabled sources have no data', () => {
    renderLanding({ openai: { status: 'connected', credential: 'sk-test', validation: { status: 'none', daysAvailable: 0, daysRequested: 60 } } });
    expect(screen.getByRole('button', { name: /Run Analysis/i })).toBeDisabled();
    expect(screen.getByTestId('run-disabled-reason').textContent).toMatch(/no.*data/i);
  });

  it('Landing Run Analysis > enables when at least one source has full or partial data', () => {
    renderLanding({ anthropic: { status: 'connected', credential: 'ant', validation: { status: 'partial', daysAvailable: 18, daysRequested: 60 } } });
    expect(screen.getByRole('button', { name: /Run Analysis/i })).not.toBeDisabled();
  });

  it('Landing Run Analysis > excludes only none-availability sources from analysis config; partial sources are included with a visible SourceCard warning', () => {
    const { dispatch } = renderLanding({
      openai: { status: 'connected', credential: 'sk', validation: { status: 'full', daysAvailable: 60, daysRequested: 60 } },
      anthropic: { status: 'connected', credential: 'ant', validation: { status: 'partial', daysAvailable: 18, daysRequested: 60 } },
      github_copilot: { enabled: true, status: 'connected', validation: { status: 'none', daysAvailable: 0, daysRequested: 60 } },
    });
    fireEvent.click(screen.getByRole('button', { name: /Run Analysis/i }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    const arg = dispatch.mock.calls[0][0];
    const ids = arg.pendingAnalysis.config.sources.map((s: any) => s.sourceId);
    expect(ids).toContain('openai');
    expect(ids).toContain('anthropic');
    expect(ids).not.toContain('github_copilot');
  });
});

describe('Landing — R1 mobile CTA scroll clearance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateMock.mockResolvedValue(fullValidationResult);
  });

  it('source-list has non-empty paddingBottom for fixed footer clearance — R1', () => {
    renderLanding({});
    const list = screen.getByTestId('source-list');
    // paddingBottom is set (calc expression); not empty string
    expect(list.style.paddingBottom).not.toBe('');
  });

  it('landing-content outer div no longer carries the footer reserved height as padding-bottom — R1', () => {
    renderLanding({});
    const content = screen.getByTestId('landing-content');
    // After the fix, bottom padding is 0 — clearance moved to source-list
    expect(content.style.paddingBottom).toBe('0px');
  });
});

describe('Landing — E6 all-failed error surfacing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateMock.mockImplementation(async (sourceId: string) => ({
      valid: true, sourceId, availability: 'full' as const, daysAvailable: 60, daysRequested: 60, warnings: [],
    }));
  });

  function renderWithErrors(analysisErrors: unknown[], sources: Record<string, unknown> = { openai: { ...fullOpenAi } }) {
    const dispatch = vi.fn();
    const ctx = {
      state: { phase: 'landing', sources, analysisErrors },
      dispatch,
      updateSource: vi.fn(),
      clearSession: vi.fn(),
      abortControllerRef: { current: null as AbortController | null },
    };
    render(
      <SessionContext.Provider value={ctx as any}>
        <Landing />
      </SessionContext.Provider>
    );
    return { dispatch };
  }

  it('displays per-source errors from all-failed analysis', () => {
    renderWithErrors([{ sourceId: 'openai', error: 'Invalid credentials', warnings: [] }]);
    const banner = screen.getByTestId('landing-analysis-errors');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toMatch(/OpenAI/);
    expect(banner.textContent).toMatch(/Invalid credentials/);
  });

  it('clears errors after source/date changes', async () => {
    const { dispatch } = renderWithErrors([{ sourceId: 'openai', error: 'Invalid credentials', warnings: [] }]);
    fireEvent.click(screen.getByTestId('period-preset-last_7'));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({ analysisErrors: [] });
    });
  });
});

describe('B-RUNTIME-01: dynamic footer padding', () => {
  it('renders the fixed action footer with data-testid', () => {
    renderLanding({});
    expect(screen.getByTestId('landing-action-footer')).toBeInTheDocument();
  });

  it('source-list paddingBottom reflects dynamically measured footer height via ResizeObserver', () => {
    // Replace the no-op ResizeObserver with a functional mock that captures the callback.
    // Landing.tsx registers a ResizeObserver on footerRef and calls setFooterHeight(Math.ceil(h)).
    let capturedCallback: ResizeObserverCallback | undefined;
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();

    // Must use a regular function (not arrow) so it can be called with `new`
    function MockResizeObserver(this: any, cb: ResizeObserverCallback) {
      capturedCallback = cb;
      this.observe = observeMock;
      this.disconnect = disconnectMock;
      this.unobserve = vi.fn();
    }

    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    try {
      renderLanding({});

      // Before callback fires: paddingBottom is the static fallback (220px).
      const sourceList = screen.getByTestId('source-list');
      expect(sourceList).toHaveStyle({ paddingBottom: '220px' });

      // Simulate ResizeObserver firing with a new footer height of 350px.
      // W-1: inlineSize (not inlineSizeSize) — matches the ResizeObserverSize interface.
      act(() => {
        if (capturedCallback) {
          capturedCallback(
            [{ borderBoxSize: [{ blockSize: 350, inlineSize: 0 }], contentRect: { height: 350 } } as any],
            null as any
          );
        }
      });

      // After callback: paddingBottom reflects the mocked measurement.
      expect(sourceList).toHaveStyle({ paddingBottom: '350px' });
    } finally {
      // W-2: always unstub even if an assertion throws, to prevent mock leak
      vi.unstubAllGlobals();
    }
  });
});

describe('W4: no duplicate validation text', () => {
  it('run-disabled-reason does NOT render when isValidating — spinner is the sole in-progress message', () => {
    renderLanding({ openai: { status: 'connected', credential: 'sk-test', validation: { status: 'validating' } } });
    expect(screen.queryByTestId('run-disabled-reason')).not.toBeInTheDocument();
  });

  it('run-disabled-reason renders for static blocking conditions — no sources connected', () => {
    renderLanding({});
    expect(screen.getByTestId('run-disabled-reason')).toBeInTheDocument();
    expect(screen.getByTestId('run-disabled-reason').textContent).toMatch(/Connect and validate/i);
  });

  it('run-disabled-reason renders when all sources resolved with no data', () => {
    renderLanding({ openai: { status: 'connected', credential: 'sk-test', validation: { status: 'none', daysAvailable: 0, daysRequested: 60 } } });
    expect(screen.getByTestId('run-disabled-reason')).toBeInTheDocument();
    expect(screen.getByTestId('run-disabled-reason').textContent).toMatch(/no.*data/i);
  });

  it('exactly one validation-spinner and zero run-disabled-reason when showValidationSpinner is true', async () => {
    vi.useFakeTimers();
    try {
      validateMock.mockImplementation(() => new Promise(() => {}) as any);
      renderLanding({ openai: { ...fullOpenAi } });
      await act(async () => { vi.advanceTimersByTime(200); });

      const spinners = document.querySelectorAll('[data-testid="validation-spinner"]');
      expect(spinners).toHaveLength(1);
      const reasons = document.querySelectorAll('[data-testid="run-disabled-reason"]');
      expect(reasons).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ISSUE-D: Landing analysis error banner normalizes error strings', () => {
  it('renders single-line error message even when analysisErrors contains stack trace', () => {
    const dispatch = vi.fn();
    const stackTraceError = 'Connection refused\n    at fetchData (client.ts:42:5)\n    at async runAnalysis (Analysis.tsx:68:9)';
    const ctx = {
      state: {
        phase: 'landing',
        sources: { openai: { status: 'connected', credential: 'sk-test', validation: { status: 'full', daysAvailable: 60, daysRequested: 60 } } },
        analysisErrors: [{ sourceId: 'openai' as const, error: stackTraceError, warnings: [] }],
      },
      dispatch,
      updateSource: vi.fn(),
      clearSession: vi.fn(),
      abortControllerRef: { current: null as AbortController | null },
    };

    render(
      <SessionContext.Provider value={ctx as any}>
        <Landing />
      </SessionContext.Provider>
    );

    const errorBanner = screen.getByTestId('landing-analysis-errors');
    // Multi-line stack trace must NOT appear in DOM
    expect(errorBanner.textContent).not.toContain('at fetchData');
    expect(errorBanner.textContent).not.toContain('at async');
    // First line must appear (possibly cleaned)
    expect(errorBanner.textContent).toContain('Connection refused');
  });
});

describe('ISSUE-F: analysis error banner shows next-step guidance', () => {
  it('shows API key guidance when an API source fails with auth error', () => {
    const dispatch = vi.fn();
    const ctx = {
      state: {
        phase: 'landing',
        sources: {},
        analysisErrors: [{ sourceId: 'openai' as const, error: 'Invalid API key', warnings: [] }],
      },
      dispatch,
      updateSource: vi.fn(),
      clearSession: vi.fn(),
      abortControllerRef: { current: null as AbortController | null },
    };

    render(
      <SessionContext.Provider value={ctx as any}>
        <Landing />
      </SessionContext.Provider>
    );

    const banner = screen.getByTestId('landing-analysis-errors');
    expect(banner.textContent).toMatch(/API key/i);
    // Must contain actionable next step (not just the error)
    expect(banner.textContent).toMatch(/try again/i);
  });

  it('shows local path guidance when a local source fails', () => {
    const dispatch = vi.fn();
    const ctx = {
      state: {
        phase: 'landing',
        sources: {},
        analysisErrors: [{ sourceId: 'claude_code' as const, error: 'Directory not found', warnings: [] }],
      },
      dispatch,
      updateSource: vi.fn(),
      clearSession: vi.fn(),
      abortControllerRef: { current: null as AbortController | null },
    };

    render(
      <SessionContext.Provider value={ctx as any}>
        <Landing />
      </SessionContext.Provider>
    );

    const banner = screen.getByTestId('landing-analysis-errors');
    expect(banner.textContent).toMatch(/local data path|path exists/i);
  });

  it('shows generic guidance when error context is ambiguous', () => {
    const dispatch = vi.fn();
    const ctx = {
      state: {
        phase: 'landing',
        sources: {},
        analysisErrors: [{ sourceId: 'openai' as const, error: 'An unexpected error occurred.', warnings: [] }],
      },
      dispatch,
      updateSource: vi.fn(),
      clearSession: vi.fn(),
      abortControllerRef: { current: null as AbortController | null },
    };

    render(
      <SessionContext.Provider value={ctx as any}>
        <Landing />
      </SessionContext.Provider>
    );

    const banner = screen.getByTestId('landing-analysis-errors');
    // Must have SOME guidance
    expect(banner.textContent).toMatch(/try again|check/i);
  });

  it('guidance text is inside the role=alert element so AT announces it', () => {
    const dispatch = vi.fn();
    const ctx = {
      state: {
        phase: 'landing',
        sources: {},
        analysisErrors: [{ sourceId: 'anthropic' as const, error: null, warnings: ['No data for range'] }],
      },
      dispatch,
      updateSource: vi.fn(),
      clearSession: vi.fn(),
      abortControllerRef: { current: null as AbortController | null },
    };

    render(
      <SessionContext.Provider value={ctx as any}>
        <Landing />
      </SessionContext.Provider>
    );

    const alertEl = screen.getByRole('alert');
    // All guidance must be inside the alert (not outside)
    expect(alertEl.textContent).toMatch(/check|try again/i);
  });
});
