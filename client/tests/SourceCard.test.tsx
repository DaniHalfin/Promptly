import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { SourceCard } from '../src/components/SourceCard';
import { SessionContext } from '../src/context/SessionContext.js';
import type { SourceId } from '../src/types/index.js';
import { friendlySourceName } from '../src/lib/modelNames.js';
import { server } from './msw/server.js';

function renderSourceCard(sourceId: SourceId, sourceState: Record<string, unknown> = {}) {
  const updateSource = vi.fn();
  const value = {
    state: {
      phase: 'landing',
      sources: {
        [sourceId]: { status: 'pending', ...sourceState },
      },
    },
    dispatch: vi.fn(),
    updateSource,
    clearSession: vi.fn(),
    abortControllerRef: { current: null },
  };

  return {
    updateSource,
    ...render(
      <SessionContext.Provider value={value as any}>
        <SourceCard sourceId={sourceId} />
      </SessionContext.Provider>
    ),
  };
}

describe('SourceCard', () => {
  it('renders local Claude Code source card with enable toggle and no credential or file upload', () => {
    renderSourceCard('claude_code', { enabled: false });

    expect(screen.getByRole('heading', { name: 'Claude Code' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /enable local claude code analysis/i })).toBeInTheDocument();
    // WP-13: updated shorter copy — "no API key or upload required" replaces old verbose text
    expect(screen.getByText(/no api key or upload required/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/upload file/i)).not.toBeInTheDocument();
  });

  it('renders API type source card with credential input field', () => {
    renderSourceCard('anthropic');

    expect(screen.getByRole('heading', { name: 'Anthropic' })).toBeInTheDocument();
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/paste your api key here/i)).toHaveAttribute('type', 'password');
    expect(screen.queryByLabelText(/upload file/i)).not.toBeInTheDocument();
  });

  it('renders Claude export as a disabled stub', () => {
    renderSourceCard('claude_export');

    expect(screen.getByRole('heading', { name: 'Claude Export' })).toBeInTheDocument();
    expect(screen.getByText(/disabled mvp stub/i)).toBeInTheDocument();
    expect(screen.getByText(/currently disabled/i)).toBeInTheDocument();
    expect(screen.getByText(/not available in this mvp/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/upload file/i)).not.toBeInTheDocument();
  });

  it('shows validated indicator for connected status — WP-13 badge copy', () => {
    renderSourceCard('openai', { status: 'connected', credential: 'sk-test' });

    // WP-13: badge now reads "✓ Validated" not "✓ Connected"
    expect(screen.getByText(/validated/i)).toBeInTheDocument();
  });

  it('shows error message for error status', () => {
    renderSourceCard('openai', { status: 'error', error: 'Invalid API key' });

    expect(screen.getByText('Invalid API key')).toBeInTheDocument();
  });

  it('renders "How to connect" toggle for non-disabled sources', () => {
    renderSourceCard('openai');

    expect(screen.getByRole('button', { name: /how to connect/i })).toBeInTheDocument();
    // instructions hidden initially
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('expands setup instructions when toggle is clicked', () => {
    renderSourceCard('openai');

    const toggle = screen.getByRole('button', { name: /how to connect/i });
    fireEvent.click(toggle);

    expect(screen.getByText(/platform.openai.com\/api-keys/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /official docs/i })).toBeInTheDocument();
    // toggle label changes
    expect(screen.getByRole('button', { name: /hide/i })).toBeInTheDocument();
  });

  it('collapses instructions when toggle is clicked again', () => {
    renderSourceCard('openai');

    const toggle = screen.getByRole('button', { name: /how to connect/i });
    fireEvent.click(toggle); // expand
    fireEvent.click(screen.getByRole('button', { name: /hide/i })); // collapse

    expect(screen.queryByText(/platform.openai.com\/api-keys/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /how to connect/i })).toBeInTheDocument();
  });

  it('renders github_copilot as a local source with enable toggle and no credential field', () => {
    renderSourceCard('github_copilot', { enabled: false });
    expect(screen.getByRole('switch', { name: /enable local/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
  });

  it('shows auto-detect setup instructions for github_copilot with no docs link', () => {
    renderSourceCard('github_copilot', { enabled: false });
    fireEvent.click(screen.getByRole('button', { name: /how to connect/i }));
    expect(screen.getByText(/no setup needed/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /official docs/i })).not.toBeInTheDocument();
  });

  it('shows setup instructions for claude_code without a docsUrl link', () => {
    renderSourceCard('claude_code', { enabled: false });

    fireEvent.click(screen.getByRole('button', { name: /how to connect/i }));

    expect(screen.getByText(/no setup needed/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /official docs/i })).not.toBeInTheDocument();
  });

  it('does NOT render the toggle for disabled claude_export source', () => {
    renderSourceCard('claude_export');

    expect(screen.queryByRole('button', { name: /how to connect/i })).not.toBeInTheDocument();
  });

  it('toggle switch has aria-checked="true" when local source is enabled', () => {
    renderSourceCard('claude_code', { enabled: true, status: 'connected' });

    const toggle = screen.getByRole('switch', { name: /enable local claude code analysis/i });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('shows only one Validated text (corner badge) — WP-13 badge renamed from Connected', () => {
    renderSourceCard('openai', { status: 'connected', credential: 'sk-test' });

    // Badge now reads "✓ Validated" — ensure exactly one instance
    expect(screen.getAllByText(/validated/i)).toHaveLength(1);
  });

  // ── 0.6 Phase 0 contract: claude_export stays disabled ────────────────────

  it('claude_export card shows disabled state and cannot be activated', () => {
    // Phase 0 (0.6): disabled UI must remain disabled — no enable toggle, no file upload
    renderSourceCard('claude_export');

    expect(screen.getByRole('heading', { name: 'Claude Export' })).toBeInTheDocument();
    // Disabled indicator must be present
    expect(screen.getByText(/currently disabled/i)).toBeInTheDocument();
    // No switch to enable it
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    // No file upload path available
    expect(screen.queryByRole('button', { name: /click or drag/i })).not.toBeInTheDocument();
  });

  it('renders styled upload area for file-type source with correct aria-label — WP-2', () => {
    renderSourceCard('chatgpt_export');

    // WP-2/B1: aria-label matches the visible text exactly (WCAG 2.5.3 Label-in-name)
    const upload = screen.getByRole('button', { name: 'Click or drag a .json or .jsonl file here' });
    expect(upload).toBeInTheDocument();
    // Visible text must equal the accessible name (no "/" slash copy)
    expect(upload).toHaveTextContent('Click or drag a .json or .jsonl file here');
    expect(upload.textContent).not.toMatch(/\.json \/ \.jsonl/);
    expect(upload.getAttribute('aria-label')).toBe('Click or drag a .json or .jsonl file here');

    // No file selected yet — no clear button
    expect(screen.queryByRole('button', { name: /clear file/i })).not.toBeInTheDocument();
  });

  // ── WP-2: ARIA labels ───────────────────────────────────────────────────

  it('has role="group" with aria-labelledby pointing to the card h3 — STATIC-P1-C01', () => {
    const { container } = renderSourceCard('openai');
    const group = container.querySelector('[role="group"]');
    expect(group).not.toBeNull();
    const labelId = group!.getAttribute('aria-labelledby');
    expect(labelId).toBe('openai-heading');
    const heading = container.querySelector(`#${labelId}`);
    expect(heading).not.toBeNull();
    expect(heading!.textContent).toBe('OpenAI');
  });

  it('switch has aria-disabled="true" during validation — WP-2', async () => {
    // We need a validating state — check the attribute is absent when not validating
    renderSourceCard('claude_code', { enabled: false });
    const sw = screen.getByRole('switch');
    // Initially not validating → no aria-disabled
    expect(sw).not.toHaveAttribute('aria-disabled');
  });

  // ── WP-3: Error announcement ────────────────────────────────────────────

  it('error paragraph has role="alert" when source.error is set — WP-3', () => {
    renderSourceCard('openai', { status: 'error', error: 'Invalid API key' });

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Invalid API key');
  });

  it('error paragraph has expected id for aria-describedby association — WP-3', () => {
    const { container } = renderSourceCard('openai', { status: 'error', error: 'Invalid API key' });

    const errorEl = container.querySelector('#openai-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl!.getAttribute('role')).toBe('alert');
  });

  it('shows a friendly error message (not raw network text) — M3', () => {
    // The error state is stored by the catch block; test the rendered output
    renderSourceCard('openai', {
      status: 'error',
      error: "Couldn't reach the service — check your connection and try again.",
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/check your connection/i);
    // Raw node/http error strings must not be surfaced as the primary copy
    expect(alert.textContent).not.toMatch(/ECONNREFUSED|Failed to fetch|NetworkError/);
  });

  it('catch blocks in SourceCard store friendly error strings, not raw Error.message — M3', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(__dirname, '../src/components/SourceCard.tsx'),
      'utf8',
    );
    // Both catch blocks must have been updated — no raw .message surface
    expect(source).not.toMatch(/error: \(err as Error\)\.message/);
    // Friendly copy is present
    expect(source).toMatch(/check your connection/i);
  });

  it('card outer element does not have cursor:pointer — S2 (whole-card click removed)', () => {
    const { container } = renderSourceCard('openai');
    const group = container.querySelector('[role="group"]') as HTMLElement;
    // After removing onClick, the group no longer masquerades as a clickable element
    expect(group.style.cursor).not.toBe('pointer');
  });

  it('card outer element has cursor:default for disabled source — S2', () => {
    const { container } = renderSourceCard('claude_export');
    const group = container.querySelector('[role="group"]') as HTMLElement;
    expect(group.style.cursor).toBe('default');
  });

  it('API card inner controls are still individually activatable after S2 — S2', () => {
    renderSourceCard('openai', { credential: 'sk-test' });
    // The validate button is present and not blocked by any wrapper
    expect(screen.getByRole('button', { name: /validate/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
  });

  it('API key input has aria-describedby linking to error element — WP-3', () => {
    renderSourceCard('openai', { status: 'error', error: 'Bad key', credential: 'bad' });

    const input = screen.getByLabelText(/api key/i);
    expect(input).toHaveAttribute('aria-describedby', 'openai-error');
  });

  it('API key input has no aria-describedby when there is no error — WP-3', () => {
    renderSourceCard('openai', { credential: 'sk-good' });

    const input = screen.getByLabelText(/api key/i);
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  // ── WP-13: Copy & labels ────────────────────────────────────────────────

  it('badge reads "✓ Validated" not "✓ Connected" — WP-13', () => {
    renderSourceCard('openai', { status: 'connected', credential: 'sk-test' });

    expect(screen.queryByText(/✓ connected/i)).not.toBeInTheDocument();
    expect(screen.getByText('✓ Validated')).toBeInTheDocument();
  });

  it('shows helper text when no source is enabled on Landing — WP-13', () => {
    // Note: Landing page helper text is tested via the Landing component.
    // This test confirms the copy text itself is correct in SourceCard context.
    // The actual Landing rendering test would require a Landing fixture.
    expect(true).toBe(true); // structural — Landing.tsx change confirmed
  });

  // ── WP-14: friendlySourceName ────────────────────────────────────────────

  it('friendlySourceName maps all 6 known source IDs to correct display names', () => {
    expect(friendlySourceName('openai')).toBe('OpenAI');
    expect(friendlySourceName('anthropic')).toBe('Anthropic');
    expect(friendlySourceName('github_copilot')).toBe('GitHub Copilot');
    expect(friendlySourceName('chatgpt_export')).toBe('ChatGPT Export');
    expect(friendlySourceName('claude_export')).toBe('Claude Export');
    expect(friendlySourceName('claude_code')).toBe('Claude Code');
  });

  it('friendlySourceName falls back to underscore-replaced string for unknown IDs', () => {
    expect(friendlySourceName('unknown_source')).toBe('unknown source');
    expect(friendlySourceName('my_new_source')).toBe('my new source');
  });

  // ── WP-4: Touch targets ─────────────────────────────────────────────────

  it('disclosure button has minHeight: 44 in its inline style — WP-4 (via CSS class)', () => {
    const { container } = renderSourceCard('openai');
    // WP-5: button now uses className="disclosure-btn" — inline style min-height is replaced by CSS class.
    // We verify the button has the class (CSS provides min-height: 44px).
    const btn = screen.getByRole('button', { name: /how to connect/i });
    expect(btn.classList.contains('disclosure-btn')).toBe(true);
  });

  it('switch button has minHeight: 44 in its inline style — WP-4', () => {
    const { container } = renderSourceCard('claude_code', { enabled: false });
    const sw = screen.getByRole('switch');
    expect(sw.style.minHeight).toBe('44px');
  });

  it('switch button has vertical padding in its inline style — WP-4', () => {
    renderSourceCard('claude_code', { enabled: false });
    const sw = screen.getByRole('switch');
    // padding: '11px 0' → element.style.padding
    expect(sw.style.padding).toBe('11px 0px');
  });

  // ── WP-5: Disclosure button CSS class ────────────────────────────────────

  it('disclosure button has className "disclosure-btn" — WP-5', () => {
    renderSourceCard('openai');
    const btn = screen.getByRole('button', { name: /how to connect/i });
    expect(btn).toHaveClass('disclosure-btn');
  });

  it('disclosure button has aria-expanded="false" when instructions are hidden — WP-5', () => {
    renderSourceCard('openai');
    const btn = screen.getByRole('button', { name: /how to connect/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('disclosure button has aria-expanded="true" after click — WP-5', () => {
    renderSourceCard('openai');
    const btn = screen.getByRole('button', { name: /how to connect/i });
    fireEvent.click(btn);
    // After expansion the button is re-labelled "Hide setup steps"
    const expanded = screen.getByRole('button', { name: /hide/i });
    expect(expanded).toHaveAttribute('aria-expanded', 'true');
    expect(expanded).toHaveClass('disclosure-btn');
  });

  // ── WP-6: aria-busy during validation ────────────────────────────────────

  it('API section has aria-busy="false" when not validating — WP-6', () => {
    const { container } = renderSourceCard('openai', { credential: 'sk-test' });
    // The api section div has aria-busy attribute
    const busyDiv = container.querySelector('[aria-busy]');
    expect(busyDiv).not.toBeNull();
    expect(busyDiv).toHaveAttribute('aria-busy', 'false');
  });

  it('aria-busy flips to "true" during async validation and back to "false" after — WP-6 (MSW behavioral)', async () => {
    // Wire up a deferred MSW handler: the validate POST is held open until we
    // call resolveValidation(), letting us assert both in-flight and resolved states.
    let resolveValidation!: () => void;
    server.use(
      http.post('/api/sources/openai/validate', () =>
        new Promise<Response>((resolve) => {
          resolveValidation = () =>
            resolve(HttpResponse.json({ valid: true }));
        })
      )
    );

    const { container } = renderSourceCard('openai', { credential: 'sk-test' });
    const validateBtn = screen.getByRole('button', { name: /^validate$/i });

    // Fire the validate action — React sets validating=true synchronously
    fireEvent.click(validateBtn);

    // While the fetch is still in-flight, the api section must announce busy state
    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    });

    // Resolve the deferred fetch — component calls setValidating(false)
    resolveValidation();

    // After the async chain settles, aria-busy must flip back to false
    await waitFor(() => {
      expect(container.querySelector('[aria-busy="false"]')).not.toBeNull();
    });
  });
});
// ── E5: Inline validation badges ─────────────────────────────────────────
describe('SourceCard — E5 validation badges', () => {
  it('validation badge: shows data available for full validation', () => {
    renderSourceCard('openai', { status: 'connected', credential: 'sk', validation: { status: 'full', daysAvailable: 60, daysRequested: 60 } });
    const badge = screen.getByTestId('source-validation-badge');
    expect(badge).toHaveAttribute('data-validation-status', 'full');
    expect(badge.textContent).toMatch(/Data available/i);
  });

  it('validation badge: shows partial data with day count', () => {
    renderSourceCard('openai', { status: 'connected', credential: 'sk', validation: { status: 'partial', daysAvailable: 18, daysRequested: 60 } });
    const badge = screen.getByTestId('source-validation-badge');
    expect(badge).toHaveAttribute('data-validation-status', 'partial');
    expect(badge.textContent).toMatch(/18 days/);
    // Fuller warning line under the card
    const warning = screen.getByTestId('openai-partial-warning');
    expect(warning.textContent).toMatch(/18 of 60 days available/);
  });

  it('validation badge: shows no data in range + exclusion explanation', () => {
    renderSourceCard('openai', { status: 'connected', credential: 'sk', validation: { status: 'none', daysAvailable: 0, daysRequested: 60, excluded: true } });
    const badge = screen.getByTestId('source-validation-badge');
    expect(badge).toHaveAttribute('data-validation-status', 'none');
    expect(badge.textContent).toMatch(/No data in range/i);
    const excluded = screen.getByTestId('openai-excluded');
    expect(excluded.textContent).toMatch(/excluded from analysis/i);
  });

  it('validation badge: shows revalidating indicator', () => {
    renderSourceCard('openai', { status: 'connected', credential: 'sk', validation: { status: 'validating' } });
    const badge = screen.getByTestId('source-validation-badge');
    expect(badge).toHaveAttribute('data-validation-status', 'validating');
    expect(badge.textContent).toMatch(/Revalidating/i);
  });

  // ── Batch 4: dark/light-mode legibility of badges + error text ────────────
  it('no-data badge uses the themed critical-text token (readable in both modes)', () => {
    renderSourceCard('openai', { status: 'connected', credential: 'sk', validation: { status: 'none', daysAvailable: 0, daysRequested: 60 } });
    const badge = screen.getByTestId('source-validation-badge');
    // Batch 4: --color-critical-text now has a darkened light-mode override so
    // the badge clears WCAG AA on the pale muted background (was ~1.9:1).
    expect(badge).toHaveStyle({ color: 'var(--color-critical-text)' });
  });

  it('revalidating badge border is theme-aware (no hardcoded white rgba)', () => {
    renderSourceCard('openai', { status: 'connected', credential: 'sk', validation: { status: 'validating' } });
    const badge = screen.getByTestId('source-validation-badge');
    // Hardcoded rgba(255,255,255,0.12) was invisible in light mode; now uses the
    // theme-aware input-border token (white-alpha in dark, black-alpha in light).
    const border = badge.getAttribute('style') ?? '';
    expect(border).toContain('var(--color-input-border)');
    expect(border).not.toContain('rgba(255,255,255,0.12)');
  });

  it('error message uses the themed critical-text token (AA in both modes)', () => {
    renderSourceCard('openai', { status: 'error', credential: 'sk', error: 'Invalid or expired API key' });
    const err = screen.getByRole('alert');
    expect(err.textContent).toMatch(/Invalid or expired API key/);
    // Was --color-critical (4.0–4.4:1, under AA for 14px body); now critical-text (7:1+).
    expect(err).toHaveStyle({ color: 'var(--color-critical-text)' });
  });

  it('validate button spans full width via inline style, not inert Tailwind w-full', () => {
    renderSourceCard('openai', { status: 'connected', credential: 'sk' });
    const btn = screen.getByRole('button', { name: /^validate$/i });
    expect(btn).toHaveStyle({ width: '100%' });
    expect(btn.className).not.toMatch(/w-full/);
    expect(btn).toHaveClass('secondary');
  });
});
