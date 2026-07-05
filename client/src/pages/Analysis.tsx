import React, { useEffect, useState } from 'react';
import { useSession } from '../context/SessionContext.js';
import { ThemeToggle } from '../components/ThemeToggle.js';
import { apiClient } from '../api/client.js';
import type { SourceId, SourceReport } from '../types/index.js';

const SOURCE_LABELS: Record<string, string> = {
  github_copilot: 'GitHub Copilot',
  claude_code: 'Claude Code',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  chatgpt_export: 'ChatGPT Export',
  claude_export: 'Claude Export',
};

type SourceProgressState = 'pending' | 'fetching' | 'done' | 'error';

export function Analysis() {
  const { state, dispatch, abortControllerRef } = useSession();
  const [elapsed, setElapsed] = useState(0);
  const [sourceProgress, setSourceProgress] = useState<Record<string, SourceProgressState>>({});
  const [buildingStep, setBuildingStep] = useState<'idle' | 'building' | 'generating'>('idle');

  const enabledIds = (Object.keys(state.sources) as SourceId[]).filter(id => {
    const s = state.sources[id];
    return s?.status === 'connected' || s?.status === 'ready' || s?.enabled;
  });

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    dispatch({ phase: 'connection' });
  };

  // WP-12: Respect prefers-reduced-motion for step icon animations
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Capture current values for use in the async closure
    const ids = enabledIds;
    const sources = state.sources;
    const pendingConfig = state.pendingAnalysis?.config;

    // Initialize all sources as pending
    const initial: Record<string, SourceProgressState> = {};
    ids.forEach(id => { initial[id] = 'pending'; });
    setSourceProgress(initial);

    const runAnalysis = async () => {
      try {
        const sourceResults: SourceReport[] = [];

        // Run sources sequentially for predictable progress display
        for (const sourceId of ids) {
          if (controller.signal.aborted) return;

          setSourceProgress(prev => ({ ...prev, [sourceId]: 'fetching' }));

          try {
            const sourceState = sources[sourceId];
            const credential = sourceState?.credential;
            const file = (sourceState as any)?.file as File | undefined;
            const srcConfig = pendingConfig?.sources.find(s => s.sourceId === sourceId);

            const result = await apiClient.analyzeSource(
              sourceId,
              credential,
              file,
              srcConfig?.startDate,
              srcConfig?.endDate,
              controller.signal,
            );

            sourceResults.push(result);
            setSourceProgress(prev => ({ ...prev, [sourceId]: 'done' }));
          } catch (err) {
            if (controller.signal.aborted) return;
            sourceResults.push({
              source_id: sourceId,
              tier: null,
              connected: false,
              error: (err as Error).message,
              metrics: null,
            });
            setSourceProgress(prev => ({ ...prev, [sourceId]: 'error' }));
          }
        }

        if (controller.signal.aborted) return;

        setBuildingStep('building');

        const report = await apiClient.analyzeRecommendations(sourceResults, controller.signal);

        if (!controller.signal.aborted) {
          setBuildingStep('generating');
          dispatch(
            report.cross_source_summary.allSourcesFailed
              ? { phase: 'connection', report }
              : { phase: 'results', report }
          );
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        dispatch({ phase: 'error', analysisError: (err as Error).message });
      } finally {
        abortControllerRef.current = null;
      }
    };

    runAnalysis();

    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    const beforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);

    return () => {
      controller.abort();
      clearInterval(interval);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  const getProgressIcon = (ps: SourceProgressState) => {
    if (ps === 'done') return '✓';
    if (ps === 'fetching') return '●';
    if (ps === 'error') return '✗';
    return '○';
  };

  const getProgressColor = (ps: SourceProgressState) => {
    if (ps === 'done') return 'var(--color-positive-text)';
    if (ps === 'fetching') return 'var(--color-accent-light)';
    if (ps === 'error') return 'var(--color-critical-text)';
    return 'var(--text-disabled)';
  };

  const doneCount = Object.values(sourceProgress).filter(s => s === 'done' || s === 'error').length;
  const totalSources = enabledIds.length;
  const extraSteps = 2; // building + generating
  const progressPct = totalSources > 0
    ? Math.min(Math.round(((doneCount + (buildingStep !== 'idle' ? 1 : 0)) / (totalSources + extraSteps)) * 100), 99)
    : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-base)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Promptly</span>
        <ThemeToggle />
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          {/* WP-7: tabIndex={-1} + data-focus-on-mount enables programmatic focus on phase transition */}
          <h1
            tabIndex={-1}
            data-focus-on-mount
            style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em', outline: 'none' }}
          >
            Analyzing your AI usage
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 32 }}>
            Elapsed: {formatTime(elapsed)}
          </p>

          {/* Per-source progress list */}
          <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {enabledIds.map(sourceId => {
              const ps = sourceProgress[sourceId] ?? 'pending';
              const label = SOURCE_LABELS[sourceId] ?? sourceId;
              return (
                <div
                  key={sourceId}
                  data-testid={`source-progress-${sourceId}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <span style={{
                    width: 20, height: 20, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.875rem',
                    color: getProgressColor(ps),
                    animation: ps === 'fetching' && !prefersReducedMotion ? 'stepPulse 1.2s ease-in-out infinite' : 'none',
                  }}>
                    {getProgressIcon(ps)}
                  </span>
                  <span style={{
                    fontSize: '0.875rem',
                    color: ps === 'pending' ? 'var(--text-disabled)' : ps === 'fetching' ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: ps === 'fetching' ? 500 : 400,
                    transition: 'color 300ms ease',
                  }}>
                    {ps === 'fetching' ? `Analyzing ${label}…` : ps === 'done' ? label : ps === 'error' ? `${label} (error)` : label}
                  </span>
                </div>
              );
            })}

            {/* Final steps */}
            {['Calculating costs & recommendations', 'Generating report'].map((label, i) => {
              const isActive = (i === 0 && buildingStep === 'building') || (i === 1 && buildingStep === 'generating');
              const isDone = (i === 0 && (buildingStep === 'generating')) || false;
              return (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: i === 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  <span style={{
                    width: 20, height: 20, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.875rem',
                    color: isDone ? 'var(--color-positive-text)' : isActive ? 'var(--color-accent-light)' : 'var(--text-disabled)',
                    animation: isActive && !prefersReducedMotion ? 'stepPulse 1.2s ease-in-out infinite' : 'none',
                  }}>
                    {isDone ? '✓' : isActive ? '●' : '○'}
                  </span>
                  <span style={{
                    fontSize: '0.875rem',
                    color: isDone ? 'var(--text-muted)' : isActive ? 'var(--text-primary)' : 'var(--text-disabled)',
                    fontWeight: isActive ? 500 : 400,
                  }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* WP-12: Use .progress-fill class so @media (prefers-reduced-motion) can suppress transition */}
          <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', marginBottom: 32 }}>
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>

          <button className="danger" onClick={handleCancel} style={{ width: '100%' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}