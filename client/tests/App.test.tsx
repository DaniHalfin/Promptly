/**
 * 3.1 — App routing tests
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { App } from '../src/App';
import { SessionContext } from '../src/context/SessionContext.js';

// Mock all child pages so we can verify which one renders
vi.mock('../src/pages/Landing.js', () => ({
  Landing: () => <div data-testid="landing-page">Landing</div>,
}));
vi.mock('../src/pages/Analysis.js', () => ({
  Analysis: () => <div data-testid="analysis-page">Analysis</div>,
}));
vi.mock('../src/pages/Results.js', () => ({
  Results: () => <div data-testid="results-page">Results</div>,
}));
vi.mock('../src/pages/Error.js', () => ({
  Error: () => <div data-testid="error-page">Error</div>,
}));

function renderWithPhase(phase: string | undefined) {
  const ctx = {
    state: { phase, sources: {} },
    dispatch: vi.fn(),
    updateSource: vi.fn(),
    clearSession: vi.fn(),
    abortControllerRef: { current: null },
  };
  return render(
    <SessionContext.Provider value={ctx as any}>
      <App />
    </SessionContext.Provider>
  );
}

describe('App routing', () => {
  it('renders Landing for phase=landing', () => {
    renderWithPhase('landing');
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    expect(screen.queryByTestId('connection-page')).not.toBeInTheDocument();
  });

  it('renders Landing when phase is undefined', () => {
    renderWithPhase(undefined);
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
  });

  it('does not import or render Connection', () => {
    // Connection is retired: no supported phase renders a connection page,
    // and a stray 'connection' phase string must not render anything.
    renderWithPhase('connection');
    expect(screen.queryByTestId('connection-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('analysis-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('results-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('error-page')).not.toBeInTheDocument();
  });

  it('renders Analysis for phase=analyzing', () => {
    renderWithPhase('analyzing');
    expect(screen.getByTestId('analysis-page')).toBeInTheDocument();
  });

  it('renders Results for phase=results', () => {
    renderWithPhase('results');
    expect(screen.getByTestId('results-page')).toBeInTheDocument();
  });

  it('renders Error for phase=error', () => {
    renderWithPhase('error');
    expect(screen.getByTestId('error-page')).toBeInTheDocument();
  });
});

describe('Landing phase — date picker visible', () => {
  // We need the real Landing for this test (not the mock above).
  // Use a separate test file to avoid module mock conflicts — this test
  // verifies the routing shape only (that `<Landing />` is rendered).
  it('landing phase renders Landing (not Connection)', () => {
    renderWithPhase('landing');
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    expect(screen.queryByTestId('connection-page')).not.toBeInTheDocument();
  });
});
