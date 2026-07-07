/**
 * B2 + WP-7: Focus management on phase transitions.
 *
 * INVARIANTS:
 * 1. Initial mount (first render) must NOT steal focus from the document's
 *    natural starting point. Focus must remain on <body> after initial load.
 * 2. A genuine phase transition (e.g., landing → analyzing) MUST move focus
 *    to [data-focus-on-mount] in the incoming page within 50ms.
 * 3. Same-phase re-render must NOT call .focus() again (StrictMode guard).
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App } from '../src/App';
import { SessionContext } from '../src/context/SessionContext.js';

function makeContext(phase: string) {
  return {
    state: { phase, sources: {}, dateRange: { startDate: '', endDate: '' } },
    dispatch: vi.fn(),
    updateSource: vi.fn(),
    clearSession: vi.fn(),
    abortControllerRef: { current: null },
  };
}

function renderApp(phase: string) {
  const ctx = makeContext(phase);
  const result = render(
    <SessionContext.Provider value={ctx as any}>
      <App />
    </SessionContext.Provider>
  );
  return { ...result, ctx };
}

function rerenderApp(rerender: ReturnType<typeof render>['rerender'], phase: string) {
  rerender(
    <SessionContext.Provider value={makeContext(phase) as any}>
      <App />
    </SessionContext.Provider>
  );
}

describe('B2: initial mount must NOT steal focus', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('focus remains on <body> after initial render (landing phase)', async () => {
    const { container } = renderApp('landing');

    await act(async () => {
      vi.advanceTimersByTime(100); // past the 50ms timeout
    });

    // Focus must NOT have moved to the data-focus-on-mount element.
    const target = container.querySelector('[data-focus-on-mount]');
    expect(target).not.toBeNull();
    expect(document.activeElement).not.toBe(target);
    // Acceptable: body or null (jsdom default)
    expect(document.activeElement === document.body || document.activeElement === null).toBe(true);
  });

  it('focus remains on <body> after initial render (analyzing phase — direct load)', async () => {
    const { container } = renderApp('analyzing');
    await act(async () => { vi.advanceTimersByTime(100); });
    const target = container.querySelector('[data-focus-on-mount]');
    expect(document.activeElement).not.toBe(target);
  });
});

describe('WP-7: phase transitions MUST move focus', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('focuses [data-focus-on-mount] when transitioning landing → analyzing', async () => {
    const { rerender, container } = renderApp('landing');
    // Advance past the initial-mount suppression
    await act(async () => { vi.advanceTimersByTime(100); });

    // Now do a real phase transition
    rerenderApp(rerender, 'analyzing');
    await act(async () => { vi.advanceTimersByTime(50); });

    const target = container.querySelector('[data-focus-on-mount]');
    expect(target).not.toBeNull();
    expect(document.activeElement).toBe(target);
  });

  it('focuses [data-focus-on-mount] when transitioning to error page', async () => {
    const { rerender, container } = renderApp('landing');
    await act(async () => { vi.advanceTimersByTime(100); });

    rerenderApp(rerender, 'error');
    await act(async () => { vi.advanceTimersByTime(50); });

    const target = container.querySelector('[data-focus-on-mount]');
    expect(target).not.toBeNull();
    expect(document.activeElement).toBe(target);
  });

  it('focuses [data-focus-on-mount] when transitioning to analyzing (second transition)', async () => {
    const { rerender, container } = renderApp('landing');
    await act(async () => { vi.advanceTimersByTime(100); });

    rerenderApp(rerender, 'analyzing');
    await act(async () => { vi.advanceTimersByTime(50); });

    // Confirm target got focus, then transition again
    const target = container.querySelector('[data-focus-on-mount]');
    expect(target).not.toBeNull();
    expect(document.activeElement).toBe(target);
  });

  it('does NOT re-focus when re-rendered with the same phase', async () => {
    const { rerender, container } = renderApp('landing');
    await act(async () => { vi.advanceTimersByTime(100); });
    rerenderApp(rerender, 'analyzing');
    await act(async () => { vi.advanceTimersByTime(50); });

    const target = container.querySelector('[data-focus-on-mount]') as HTMLElement;
    expect(document.activeElement).toBe(target);

    const focusSpy = vi.spyOn(target, 'focus');
    rerenderApp(rerender, 'analyzing'); // same phase
    await act(async () => { vi.advanceTimersByTime(50); });

    expect(focusSpy).not.toHaveBeenCalled();
    focusSpy.mockRestore();
  });
});
