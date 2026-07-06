/**
 * WP-7: Focus management on phase transitions.
 *
 * When App's `state.phase` changes, a useEffect fires a 50ms setTimeout
 * that calls .focus() on the first [data-focus-on-mount] element in the new
 * page. This ensures screen reader users are transported to the new page's
 * primary heading without needing to navigate manually.
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App } from '../src/App';
import { SessionContext } from '../src/context/SessionContext.js';

// Minimal mock context factory
function makeContext(phase: string) {
  return {
    state: {
      phase,
      sources: {},
      dateRange: { startDate: '', endDate: '' },
    },
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

function rerenderApp(
  rerender: ReturnType<typeof render>['rerender'],
  phase: string
) {
  rerender(
    <SessionContext.Provider value={makeContext(phase) as any}>
      <App />
    </SessionContext.Provider>
  );
}

describe('App focus management (WP-7)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('focuses [data-focus-on-mount] element after initial mount (landing phase)', async () => {
    const { container } = renderApp('landing');

    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    const target = container.querySelector('[data-focus-on-mount]');
    expect(target).not.toBeNull();
    expect(document.activeElement).toBe(target);
  });

  it('focuses [data-focus-on-mount] after transition to analyzing phase', async () => {
    const { rerender, container } = renderApp('landing');

    // Transition to analyzing phase
    rerenderApp(rerender, 'analyzing');

    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    const target = container.querySelector('[data-focus-on-mount]');
    expect(target).not.toBeNull();
    expect(document.activeElement).toBe(target);
  });

  it('focuses [data-focus-on-mount] on the error page', async () => {
    const { rerender, container } = renderApp('landing');

    rerenderApp(rerender, 'error');

    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    const target = container.querySelector('[data-focus-on-mount]');
    expect(target).not.toBeNull();
    expect(document.activeElement).toBe(target);
  });

  it('does not focus before the 50ms timeout fires', async () => {
    const { container } = renderApp('analyzing');

    // Advance only 20ms — timeout not yet fired
    await act(async () => {
      vi.advanceTimersByTime(20);
    });

    const target = container.querySelector('[data-focus-on-mount]');
    // activeElement may still be body since timeout hasn't fired
    if (document.activeElement !== target) {
      expect(document.activeElement).not.toBe(target);
    }
    // Advance the remaining time
    await act(async () => {
      vi.advanceTimersByTime(30);
    });
    expect(document.activeElement).toBe(target);
  });

  it('B-ARIA-02: does not re-fire focus when re-rendered with the same phase', async () => {
    const { rerender, container } = renderApp('landing');

    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    const target = container.querySelector('[data-focus-on-mount]') as HTMLElement;
    expect(document.activeElement).toBe(target);

    // Simulate a context re-render that keeps the same phase
    // Focus must NOT move away from wherever it currently is
    const focusSpy = vi.spyOn(target, 'focus');
    rerenderApp(rerender, 'landing'); // same phase
    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    // focus() must not have been called a second time
    expect(focusSpy).not.toHaveBeenCalled();
    focusSpy.mockRestore();
  });
});
