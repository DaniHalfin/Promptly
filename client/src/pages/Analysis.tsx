import React, { useEffect, useState, useRef } from 'react';
import { useSession } from '../context/SessionContext.js';
import { ThemeToggle } from '../components/ThemeToggle.js';
import type { SourceId } from '../types/index.js';

const SOURCE_LABELS: Record<string, string> = {
  github_copilot: 'GitHub Copilot',
  claude_code: 'Claude Code',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  chatgpt_export: 'ChatGPT Export',
  claude_export: 'Claude Export',
};

type StepState = 'pending' | 'active' | 'done';

export function Analysis() {
  const { state, dispatch, abortControllerRef } = useSession();
  const [elapsed, setElapsed] = useState(0);

  const enabledIds = Object.keys(state.sources) as SourceId[];
  const sourceSteps = enabledIds.map(id => SOURCE_LABELS[id] ?? id);
  const allSteps = [...sourceSteps.map(s => `Reading ${s} data`), 'Calculating token costs', 'Building recommendations', 'Generating report'];
  const totalSteps = allSteps.length;

  const [stepIndex, setStepIndex] = useState(0);
  const stepIndexRef = useRef(0);

  // Simulate progress through steps
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    let delay = 0;
    allSteps.forEach((_, i) => {
      const duration = i < sourceSteps.length ? 1000 : 500;
      delay += duration;
      const t = setTimeout(() => {
        if (stepIndexRef.current <= i) {
          stepIndexRef.current = i + 1;
          setStepIndex(i + 1);
        }
      }, delay);
      timers.push(t);
    });

    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    const beforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(interval);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    dispatch({ phase: 'connection' });
  };

  const getStepState = (i: number): StepState => {
    if (i < stepIndex) return 'done';
    if (i === stepIndex) return 'active';
    return 'pending';
  };

  const progressPct = Math.min(Math.round((stepIndex / totalSteps) * 100), 99);
  const formatTime = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>
            Analyzing your AI usage
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 32 }}>
            Elapsed: {formatTime(elapsed)}
          </p>

          {/* Step list */}
          <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {allSteps.map((label, i) => {
              const s = getStepState(i);
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: i < allSteps.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  {/* Icon */}
                  <span style={{
                    width: 20, height: 20, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.875rem',
                    ...(s === 'done' ? { color: 'var(--color-positive-text)', animation: 'checkIn 120ms ease-out' } :
                       s === 'active' ? { color: 'var(--color-accent-light)', animation: 'stepPulse 1.2s ease-in-out infinite' } :
                       { color: 'var(--text-disabled)' }),
                  }}>
                    {s === 'done' ? '✓' : s === 'active' ? '●' : '○'}
                  </span>
                  {/* Label */}
                  <span style={{
                    fontSize: '0.875rem',
                    color: s === 'done' ? 'var(--text-muted)' : s === 'active' ? 'var(--text-primary)' : 'var(--text-disabled)',
                    fontWeight: s === 'active' ? 500 : 400,
                    transition: 'color 300ms ease',
                  }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', marginBottom: 32 }}>
            <div style={{
              height: '100%',
              width: `${progressPct}%`,
              background: 'var(--color-accent)',
              borderRadius: 'var(--radius-pill)',
              transition: 'width 600ms ease',
            }} />
          </div>

          <button className="danger" onClick={handleCancel} style={{ width: '100%' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
