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
});
