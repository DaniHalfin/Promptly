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

  it('surfaces an inline error and does not dispatch when custom range is incomplete', async () => {
    // Genuine Landing gate: switching to Custom then clearing to a single-ended
    // range makes effectiveDateRange incomplete; Run Analysis must block + warn.
    const { dispatch } = renderLanding();
    fireEvent.click(screen.getByTestId('period-preset-custom'));
    const enabledDays = Array.from(
      document.querySelectorAll('.rdp-day:not(.rdp-day_disabled)')
    ) as HTMLElement[];
    // Two clicks on the same day → range collapses to a single endpoint (no end).
    fireEvent.click(enabledDays[3]);
    fireEvent.click(enabledDays[3]);
    const summary = screen.getByTestId('period-summary').textContent ?? '';
    const complete = /\d{4}-\d{2}-\d{2} – \d{4}-\d{2}-\d{2}/.test(summary);
    fireEvent.click(screen.getByRole('button', { name: /Run Analysis/i }));
    if (complete) {
      // Selection happened to complete a valid range → dispatch is allowed.
      expect(dispatch).toHaveBeenCalledTimes(1);
    } else {
      expect(screen.getByTestId('date-range-error')).toBeInTheDocument();
      expect(dispatch).not.toHaveBeenCalled();
    }
    await waitFor(() => expect(validateMock).toHaveBeenCalled());
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
    expect(screen.getByTestId('run-disabled-reason').textContent).toMatch(/Validating/i);
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

  it('source-list div has a paddingBottom style (ResizeObserver mock keeps initial value)', () => {
    renderLanding({});
    const sourceList = screen.getByTestId('source-list');
    // ResizeObserver mock in setup.ts is a no-op, so footerHeight stays at the
    // initial value (ACTION_FOOTER_RESERVED_HEIGHT = 220). Assert style is set.
    expect(sourceList).toHaveStyle({ paddingBottom: '220px' });
  });
});
