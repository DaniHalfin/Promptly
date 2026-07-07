/**
 * WP-10: Axe-core accessibility scans on Landing and Results page components.
 *
 * Color-contrast checks in jsdom are typically "incomplete" (not "violations")
 * because CSS custom properties are not resolved in jsdom. The scan still catches:
 * - Missing ARIA labels
 * - Invalid role usage
 * - Missing landmark regions
 * - Form labeling issues
 *
 * Token values fixed in this phase:
 * - --color-input-border: rgba(255,255,255,0.35)  [was 0.12 — too low for WCAG 3:1]
 * - --text-muted: oklch(58% 0.04 240)              [was 50% — insufficient for WCAG AA on dark bg]
 */
import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, it, expect, beforeAll } from 'vitest';
import { Landing } from '../src/pages/Landing';
import { SessionContext } from '../src/context/SessionContext.js';

expect.extend(toHaveNoViolations);

// Minimal mock context for Landing page rendering
function makeLandingContext(sources: Record<string, unknown> = {}) {
  return {
    state: {
      phase: 'landing',
      sources,
      dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
    },
    dispatch: () => {},
    updateSource: () => {},
    clearSession: () => {},
    abortControllerRef: { current: null },
  };
}

function renderLanding(sources: Record<string, unknown> = {}) {
  const { container } = render(
    <SessionContext.Provider value={makeLandingContext(sources) as any}>
      <Landing />
    </SessionContext.Provider>
  );
  return container;
}

describe('WP-10: Landing page — axe accessibility scan', () => {
  it('has no axe violations', async () => {
    const container = renderLanding();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with all sources pending', async () => {
    const container = renderLanding({
      openai: { status: 'pending', credential: '' },
      anthropic: { status: 'pending', credential: '' },
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with a connected source', async () => {
    const container = renderLanding({
      openai: { status: 'connected', credential: 'sk-test' },
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with a source error state', async () => {
    const container = renderLanding({
      openai: { status: 'error', error: 'Invalid API key', credential: 'bad' },
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('WP-10: axe incomplete results contain only contrast rules — LS-8', () => {
  it('any incomplete results are only color-contrast checks (not structural violations)', async () => {
    // LS-8: jsdom cannot resolve CSS custom properties, so color-contrast rules appear
    // as "incomplete" (needs-review) rather than violations. This test guards against
    // any non-contrast rule appearing in the incomplete set — which would indicate a
    // new structural accessibility issue that was masked.
    const container = renderLanding();
    const results = await axe(container);

    // No violations allowed
    expect(results).toHaveNoViolations();

    // Filter out contrast-related incomplete items
    const nonContrastIncomplete = (results.incomplete ?? []).filter(
      (item) => !item.id.includes('color-contrast')
    );

    // Any remaining incomplete items must not be structural ARIA/landmark issues
    // (If this fails, there is a new accessibility issue that needs fixing in source.)
    expect(nonContrastIncomplete).toHaveLength(0);
  });
});
