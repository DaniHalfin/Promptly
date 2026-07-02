import React, { useState } from 'react';
import { useSession } from '../context/SessionContext.js';
import { SourceCard } from '../components/SourceCard.js';
import { ThemeToggle } from '../components/ThemeToggle.js';
import { apiClient } from '../api/client.js';
import type { SourceConfig, SourceId } from '../types/index.js';

export function Landing() {
  const { state, dispatch, abortControllerRef } = useSession();
  const [dateRange] = useState({
    start: new Date(Date.now() - 86400000 * 30).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  const hasAnyEnabled = Object.values(state.sources).some(
    s => s?.enabled || s?.status === 'connected' || s?.status === 'ready'
  );

  const isActive = (sourceId: SourceId) => {
    const source = state.sources[sourceId];
    return source?.status === 'connected' || source?.status === 'ready';
  };

  const sourceConfig = (sourceId: SourceId, hasCredential: boolean): SourceConfig => ({
    sourceId,
    hasCredential,
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const handleAnalyze = async () => {
    try {
      const config: { sources: SourceConfig[] } = {
        sources: [
          isActive('openai') ? sourceConfig('openai', true) : null,
          isActive('anthropic') ? sourceConfig('anthropic', true) : null,
          (isActive('github_copilot') || state.sources.github_copilot?.enabled) ? sourceConfig('github_copilot', false) : null,
          isActive('chatgpt_export') ? sourceConfig('chatgpt_export', false) : null,
          (isActive('claude_code') || state.sources.claude_code?.enabled) ? sourceConfig('claude_code', false) : null,
        ].filter((source): source is SourceConfig => source !== null),
      };

      dispatch({ phase: 'analyzing' });

      const credentials = {
        openai: state.sources.openai?.credential,
        anthropic: state.sources.anthropic?.credential,
      };

      const files = {
        chatgpt_export: state.sources.chatgpt_export?.file,
      };

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const report = await apiClient.analyze(config, credentials, files, controller.signal);
        if (!controller.signal.aborted) {
          dispatch(report.cross_source_summary.allSourcesFailed ? { phase: 'connection', report } : { phase: 'results', report });
        }
      } finally {
        abortControllerRef.current = null;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      dispatch({ phase: 'error', analysisError: (err as Error).message });
    }
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
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="28">
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
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 24px 160px', /* WP-8: 160px ensures last card is clear of the ~116px fixed footer bar at all font sizes */
      }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          {/* Hero text */}
          {/* WP-7: tabIndex={-1} + data-focus-on-mount enables programmatic focus on phase transition */}
          <h1
            tabIndex={-1}
            data-focus-on-mount
            style={{
              fontSize: '2.25rem',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              color: 'var(--text-primary)',
              marginBottom: 8,
              lineHeight: 1.2,
              outline: 'none',
            }}
          >
            AI Token Analytics
          </h1>
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            marginBottom: 40,
            lineHeight: 1.6,
          }}>
            Understand exactly what you spend on AI tokens — locally, with no data leaving your machine.
          </p>

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SourceCard sourceId="github_copilot" />
            <SourceCard sourceId="claude_code" />
            <SourceCard sourceId="openai" />
            <SourceCard sourceId="anthropic" />
            <SourceCard sourceId="chatgpt_export" />
          </div>
        </div>
      </div>

      {/* Sticky action footer — always visible regardless of scroll position */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: '12px 24px 16px',
        background: 'var(--color-bg-elevated)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <button
            className="primary"
            style={{ width: '100%' }}
            disabled={!hasAnyEnabled}
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
          {!hasAnyEnabled && (
            <p style={{
              fontSize: '0.75rem',
              color: 'var(--color-warning-text)',
              textAlign: 'center',
              marginTop: 4,
              lineHeight: 1.5,
            }}>
              Validate at least one source above to enable analysis.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
