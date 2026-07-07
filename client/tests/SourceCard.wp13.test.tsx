/**
 * WP-13 isolation — extracted to its own file so vi.doMock + module reset
 * cannot contaminate SourceCard.test.tsx's shared module cache.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterAll } from 'vitest';

// Mock ThemeToggle before importing Landing (no network dependency)
vi.mock('../src/components/ThemeToggle.js', () => ({ ThemeToggle: () => null }));
vi.mock('../src/components/SourceCard.js', () => ({ SourceCard: () => null }));
vi.mock('../src/api/client.js', () => ({
  apiClient: { validate: vi.fn() },
  normalizeErrorMessage: (s: string) => s,
}));

import { Landing } from '../src/pages/Landing.js';
import { SessionContext } from '../src/context/SessionContext.js';

afterAll(() => {
  vi.restoreAllMocks();
});

describe('WP-13: Landing helper text when no source is enabled', () => {
  it('shows helper text when no source is enabled on Landing — WP-13', () => {
    const ctx = {
      state: { phase: 'landing', sources: {} },
      dispatch: vi.fn(),
      updateSource: vi.fn(),
      clearSession: vi.fn(),
      abortControllerRef: { current: null },
    };

    render(
      <SessionContext.Provider value={ctx as any}>
        <Landing />
      </SessionContext.Provider>
    );

    // With no connected/enabled sources, Landing renders the helper text
    // telling the user to connect a source before running analysis.
    const reason = screen.getByTestId('run-disabled-reason');
    expect(reason).toBeInTheDocument();
    expect(reason).toHaveTextContent('Connect and validate a source card to enable analysis.');
  });
});
