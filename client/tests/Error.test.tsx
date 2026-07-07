/**
 * Unit D — Error page navigation tests
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Error as ErrorPage } from '../src/pages/Error';
import { SessionContext } from '../src/context/SessionContext.js';

function renderError() {
  const dispatch = vi.fn();
  const ctx = {
    state: { phase: 'error', sources: {}, analysisError: 'Something broke' },
    dispatch,
    updateSource: vi.fn(),
    clearSession: vi.fn(),
    abortControllerRef: { current: null },
  };
  render(
    <SessionContext.Provider value={ctx as any}>
      <ErrorPage />
    </SessionContext.Provider>
  );
  return { dispatch };
}

describe('Error page', () => {
  it('navigates to landing when Try Again is clicked', () => {
    const { dispatch } = renderError();
    fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));
    expect(dispatch).toHaveBeenCalledWith({ phase: 'landing' });
  });

  it('navigates to landing and clears sources when Start Over is clicked', () => {
    const { dispatch } = renderError();
    fireEvent.click(screen.getByRole('button', { name: /Start Over/i }));
    expect(dispatch).toHaveBeenCalledWith({ phase: 'landing', sources: {} });
  });

  it('displays the analysis error message', () => {
    renderError();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('renders actionable guidance note below the error message — FIX-12', () => {
    renderError();
    expect(screen.getByText(/check that your api keys are valid/i)).toBeInTheDocument();
  });

  it('renders centered themed error card without Tailwind dependency', () => {
    renderError();
    // Outer container is centered and full-height via inline CSS vars (no inert Tailwind)
    const page = screen.getByTestId('error-page');
    expect(page).toHaveStyle({
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
    // Heading uses the themed primary text token
    expect(screen.getByRole('heading', { name: /Analysis Failed/i })).toHaveStyle({
      color: 'var(--text-primary)',
    });
    // Action row is a flex row
    expect(screen.getByTestId('error-actions')).toHaveStyle({ display: 'flex' });
    // No inert Tailwind utility classes remain on the root
    expect(page.className).not.toMatch(/min-h-screen|items-center|justify-center/);
  });
});

describe('FIX-12: Error page actionable copy', () => {
  it('renders a guidance note below the error message', () => {
    renderError();
    expect(screen.getByText(/check that your api keys are valid/i)).toBeInTheDocument();
  });

  it('displays error message from state.analysisError', () => {
    renderError();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });
});
