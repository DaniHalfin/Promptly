import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { useSession } from '../context/SessionContext.js';
import { SourceCard } from '../components/SourceCard.js';
import { ThemeToggle } from '../components/ThemeToggle.js';
import { apiClient, normalizeErrorMessage } from '../api/client.js';
import type { SourceConfig, SourceId } from '../types/index.js';
import {
  PERIOD_PRESETS,
  type PeriodMode,
  getPresetRange,
  parseIsoDate,
  toIsoDate,
  countInclusiveDays,
  validateDateRange,
} from '../lib/dateRange.js';

const MOM_MIN_DAYS = 60;
const VALIDATION_SPINNER_DELAY_MS = 200;

/* B3: reserved scroll space so content clears the fixed action footer at all
   font sizes / mobile widths, including the iOS safe-area inset. */
const ACTION_FOOTER_RESERVED_HEIGHT = 220;
const ACTION_FOOTER_PADDING_BOTTOM = 'calc(16px + env(safe-area-inset-bottom, 0px))';

const SOURCE_LABELS: Record<string, string> = {
  github_copilot: 'GitHub Copilot',
  claude_code: 'Claude Code',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  chatgpt_export: 'ChatGPT Export',
  claude_export: 'Claude Export',
};

// SF4: contextual guidance for analysis error banner
function getAnalysisErrorHint(errors: Array<{ sourceId: SourceId; error?: string | null }>): string {
  const apiSources = new Set<SourceId>(['openai', 'anthropic']);
  const localSources = new Set<SourceId>(['github_copilot', 'claude_code']);
  const fileSources = new Set<SourceId>(['chatgpt_export', 'claude_export']);

  const hasApi = errors.some(e => apiSources.has(e.sourceId));
  const hasLocal = errors.some(e => localSources.has(e.sourceId));
  const hasFile = errors.some(e => fileSources.has(e.sourceId));

  const hasAuthError = errors.some(e =>
    apiSources.has(e.sourceId) &&
    /key|auth|credential|unauthorized|forbidden/i.test(e.error ?? '')
  );

  if (hasApi && hasAuthError) {
    return "Check that your API key is valid and has not expired, then try again. You can verify your key in your provider's account settings.";
  }
  if (hasApi) {
    return 'Check your API key and ensure your account has API access enabled, then try again.';
  }
  if (hasLocal) {
    return 'Verify the local data path exists and contains activity data for the selected date range, then try again.';
  }
  if (hasFile) {
    return 'Try re-uploading your export file. Ensure it is a valid JSON or JSONL export from your AI provider.';
  }
  return 'Check your source configuration and try again. If the error persists, try a different date range.';
}

export function Landing() {
  const { state, dispatch, updateSource } = useSession();

  const [periodMode, setPeriodMode] = useState<PeriodMode>('last_60');
  const defaultRange = useMemo(() => getPresetRange('last_60'), []);
  const [customRange, setCustomRange] = useState<DateRange | undefined>({
    from: parseIsoDate(defaultRange.start),
    to: parseIsoDate(defaultRange.end),
  });
  const [dateError, setDateError] = useState<string | null>(null);
  const [showValidationSpinner, setShowValidationSpinner] = useState(false);

  const effectiveDateRange = useMemo(
    () => periodMode === 'custom'
      ? {
          start: customRange?.from ? toIsoDate(customRange.from) : '',
          end: customRange?.to ? toIsoDate(customRange.to) : '',
        }
      : getPresetRange(periodMode),
    [periodMode, customRange]
  );

  const presetLabel = PERIOD_PRESETS.find(p => p.id === periodMode)?.label ?? 'Custom';
  const inclusiveDays = countInclusiveDays(effectiveDateRange);
  const showMomNudge = inclusiveDays > 0 && inclusiveDays < MOM_MIN_DAYS;

  // ── E4: which sources are enabled and should be validated for this range ──
  const enabledSourceIds = useMemo(
    () => (Object.keys(state.sources) as SourceId[]).filter(id => {
      const s = state.sources[id];
      return s?.status === 'connected' || s?.status === 'ready' || s?.enabled || ((s as { file?: File })?.file != null);
    }),
    [state.sources]
  );
  const enabledKey = enabledSourceIds.join(',');
  const rangeKey = `${effectiveDateRange.start}|${effectiveDateRange.end}`;

  // Sequence guard so stale validation responses are ignored.
  const validationSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const didMountRef = useRef(false);

  // B-RUNTIME-01: measure fixed footer height dynamically so paddingBottom is
  // always correct even if footer content reflows (e.g. runDisabledReason appears).
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(ACTION_FOOTER_RESERVED_HEIGHT);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;
    const observer = new ResizeObserver(([entry]) => {
      // borderBoxSize includes the safe-area padding already applied to the footer
      const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      setFooterHeight(Math.ceil(h));
    });
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  // ── E4: validation orchestration — runs on enabled-source or range change ──
  useEffect(() => {
    if (enabledSourceIds.length === 0) {
      setShowValidationSpinner(false);
      return;
    }
    if (!effectiveDateRange.start || !effectiveDateRange.end) return;

    const seq = ++validationSeq.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const validatedRange = { start: effectiveDateRange.start, end: effectiveDateRange.end };

    // Mark every enabled source as validating.
    enabledSourceIds.forEach(id => {
      updateSource(id, { validation: { status: 'validating', validatedRange } });
    });

    const spinnerTimer = setTimeout(() => {
      if (seq === validationSeq.current) setShowValidationSpinner(true);
    }, VALIDATION_SPINNER_DELAY_MS);

    (async () => {
      await Promise.all(enabledSourceIds.map(async (id) => {
        try {
          const result = await apiClient.validate(id, validatedRange.start, validatedRange.end);
          if (seq !== validationSeq.current) return; // stale response
          updateSource(id, {
            validation: {
              status: result.availability,
              daysAvailable: result.daysAvailable,
              daysRequested: result.daysRequested,
              message: result.errorMessage,
              validatedRange,
              excluded: result.availability === 'none',
            },
          });
        } catch (err) {
          if (seq !== validationSeq.current) return;
          updateSource(id, {
            validation: { status: 'error', message: (err as Error).message, validatedRange },
          });
        }
      }));
      if (seq === validationSeq.current) {
        clearTimeout(spinnerTimer);
        setShowValidationSpinner(false);
      }
    })();

    return () => {
      clearTimeout(spinnerTimer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledKey, rangeKey]);

  // ── E6: clear all-failed analysis errors when the user changes sources/range ──
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (state.analysisErrors && state.analysisErrors.length > 0) {
      dispatch({ analysisErrors: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledKey, rangeKey]);

  // ── E4: Run Analysis gating derived from validation status ──
  const isValidating = enabledSourceIds.some(id => state.sources[id]?.validation?.status === 'validating');
  const usableSourceIds = enabledSourceIds.filter(id => {
    const st = state.sources[id]?.validation?.status;
    return st === 'full' || st === 'partial';
  });
  const hasAnyUsableSource = usableSourceIds.length > 0;
  const allResolvedNoData = enabledSourceIds.length > 0 && !isValidating && !hasAnyUsableSource
    && enabledSourceIds.every(id => {
      const st = state.sources[id]?.validation?.status;
      return st === 'none' || st === 'error';
    });

  const runDisabledReason = enabledSourceIds.length === 0
    ? 'Connect and validate a source card to enable analysis.'
    : isValidating
      ? null
      : allResolvedNoData
        ? 'No selected source has data for this period.'
        : !hasAnyUsableSource
          ? 'Connect and validate a source card to enable analysis.'
          : null;

  const runDisabled = enabledSourceIds.length === 0 || isValidating || !hasAnyUsableSource;

  const sourceConfig = (sourceId: SourceId): SourceConfig => ({
    sourceId,
    hasCredential: sourceId === 'openai' || sourceId === 'anthropic',
    startDate: effectiveDateRange.start,
    endDate: effectiveDateRange.end,
  });

  const handleAnalyze = () => {
    const rangeError = validateDateRange(effectiveDateRange);
    if (rangeError) {
      setDateError(rangeError);
      return;
    }
    setDateError(null);

    // E4: include full and partial sources; exclude only `none`/`error`.
    const config: { sources: SourceConfig[] } = {
      sources: usableSourceIds.map(id => sourceConfig(id)),
    };

    dispatch({ phase: 'analyzing', pendingAnalysis: { config } });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg-base)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
            <rect width="32" height="32" rx="6" fill="var(--color-bg-elevated)"/>
            <rect x="6" y="10" width="20" height="4" rx="2" fill="var(--color-accent)"/>
            <rect x="8" y="16" width="16" height="4" rx="2" fill="var(--color-accent)"/>
            <rect x="10" y="22" width="12" height="4" rx="2" fill="var(--color-accent)"/>
            <path d="M 23,4 L 24.2,7.8 L 28,9 L 24.2,10.2 L 23,14 L 21.8,10.2 L 18,9 L 21.8,7.8 Z" fill="var(--color-accent-light)"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Promptly
          </span>
        </div>
        <ThemeToggle />
      </div>

      {/* Main content */}
      <div
        data-testid="landing-content"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '48px 24px 0',
        }}
      >
        <div style={{ width: '100%', maxWidth: 520 }}>
          {/* Hero text */}
          {/* WP-7: tabIndex={-1} + data-focus-on-mount enables programmatic focus on phase transition */}
          <h1
            tabIndex={-1}
            data-focus-on-mount
            className="focus-target"
            style={{
              fontSize: '2.25rem',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              color: 'var(--text-primary)',
              marginBottom: 8,
              lineHeight: 1.2,
            }}
          >
            AI Token Analytics
          </h1>
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            marginBottom: 32,
            lineHeight: 1.6,
          }}>
            Understand exactly what you spend on AI tokens — locally, with no data leaving your machine.
          </p>

          {/* Date range picker */}
          <div style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-input-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            marginBottom: 24,
          }}>
            <h2 style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              margin: '0 0 12px',
            }}>
              Analysis Period
            </h2>

            {/* Preset selector */}
            <div
              role="group"
              aria-label="Analysis period presets"
              style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}
            >
              {PERIOD_PRESETS.map(preset => {
                const selected = periodMode === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`period-preset-${preset.id}`}
                    aria-pressed={selected}
                    onClick={() => { setPeriodMode(preset.id); setDateError(null); }}
                    style={{
                      minHeight: 44,
                      padding: '8px 14px',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      borderRadius: 'var(--radius-pill)',
                      cursor: 'pointer',
                      border: selected ? '1px solid var(--color-accent-border)' : '1px solid var(--color-input-border)',
                      background: selected ? 'var(--color-accent-muted)' : 'transparent',
                      color: selected ? 'var(--color-accent-light)' : 'var(--text-secondary)',
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Period summary */}
            <p
              data-testid="period-summary"
              style={{ margin: '0 0 4px', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}
            >
              {presetLabel}
              {effectiveDateRange.start && effectiveDateRange.end
                ? ` · ${effectiveDateRange.start} – ${effectiveDateRange.end}`
                : ' · select a range'}
            </p>

            {/* MoM nudge */}
            {showMomNudge && (
              <p
                role="note"
                data-testid="mom-window-nudge"
                style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--color-warning-text)' }}
              >
                Add more days to enable month-over-month comparison.
              </p>
            )}

            {/* Custom range calendar */}
            {periodMode === 'custom' && (
              <div style={{ marginTop: 12 }}>
                <DayPicker
                  mode="range"
                  selected={customRange}
                  onSelect={(range) => { setCustomRange(range); setDateError(null); }}
                  disabled={{ after: new Date() }}
                  toDate={new Date()}
                  defaultMonth={customRange?.from ?? parseIsoDate(effectiveDateRange.start || toIsoDate(new Date()))}
                  className="promptly-day-picker"
                />
              </div>
            )}

            {/* Inline date error */}
            {dateError && (
              <p
                role="alert"
                data-testid="date-range-error"
                style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--color-critical-text)' }}
              >
                {dateError}
              </p>
            )}
          </div>

          {/* E6: all-failed analysis errors surfaced from the Analysis phase */}
          {state.analysisErrors && state.analysisErrors.length > 0 && (
            <div
              role="alert"
              data-testid="landing-analysis-errors"
              style={{
                background: 'var(--color-critical-muted)',
                border: '1px solid var(--color-critical)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 16px',
                marginBottom: 20,
              }}
            >
              <h2 style={{ margin: '0 0 8px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-critical-text)' }}>
                Analysis could not run for the selected sources
              </h2>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {state.analysisErrors.map(err => (
                  <li key={err.sourceId} style={{ fontSize: '0.8125rem', color: 'var(--color-critical-text)', marginBottom: 2 }}>
                    <strong>{SOURCE_LABELS[err.sourceId] ?? err.sourceId}</strong>
                    {err.error ? ` — ${normalizeErrorMessage(err.error)}` : ''}
                    {(!err.error && err.warnings && err.warnings.length > 0) ? ` — ${err.warnings.join('; ')}` : ''}
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-critical-text)', margin: '8px 0 0', lineHeight: 1.5 }}>
                {getAnalysisErrorHint(state.analysisErrors)}
              </p>
            </div>
          )}

          {/* Source cards — WP-1: h2 so SourceCard h3 headings have a valid parent heading */}
          <h2 style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 12,
            margin: '0 0 12px',
          }}>
            Connect your AI sources
          </h2>
          <div
            data-testid="source-list"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              /* B-RUNTIME-01: padding tracks the live footer height measured by ResizeObserver */
              paddingBottom: `${footerHeight}px`,
            }}
          >
            <SourceCard sourceId="github_copilot" />
            <SourceCard sourceId="claude_code" />
            <SourceCard sourceId="openai" />
            <SourceCard sourceId="anthropic" />
            <SourceCard sourceId="chatgpt_export" />
          </div>
        </div>
      </div>

      {/* Sticky action footer — always visible regardless of scroll position */}
      <div
        ref={footerRef}
        data-testid="landing-action-footer"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: `12px 24px ${ACTION_FOOTER_PADDING_BOTTOM}`,
          background: 'var(--color-bg-elevated)',
          borderTop: '1px solid var(--color-border-subtle)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          {/* E4: visible re-validation indicator when validation exceeds ~200ms */}
          {showValidationSpinner && (
            <p
              data-testid="validation-spinner"
              aria-live="polite"
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              Validating selected sources…
            </p>
          )}
          <button
            className="primary"
            style={{ width: '100%' }}
            disabled={runDisabled}
            onClick={handleAnalyze}
          >
            Run Analysis →
          </button>
          <p style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: 8,
            lineHeight: 1.5,
          }}>
            All analysis happens on your device. No credentials or files leave this machine.
          </p>
          {/* WP-13: Helper text explains why the button is disabled */}
          {runDisabledReason && (
            <p
              data-testid="run-disabled-reason"
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-warning-text)',
                textAlign: 'center',
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              {runDisabledReason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}