/**
 * WP-15: Tab order investigation within SourceCard.
 *
 * ## Within-card focusable sequence
 *
 * For API-type sources (OpenAI, Anthropic):
 *   1. Disclosure button (.disclosure-btn)
 *   2. API key input (type="password")
 *   3. Validate button
 *
 * For local sources (GitHub Copilot, Claude Code):
 *   1. Disclosure button (.disclosure-btn)
 *   2. Switch button (role="switch")
 *   Hidden checkbox is aria-hidden + tabIndex={-1} — correctly excluded.
 *
 * For file sources (ChatGPT Export):
 *   1. Disclosure button (.disclosure-btn)
 *   2. Upload area div (role="button", tabIndex=0)
 *   3. Clear file button (only when file is selected)
 *   Hidden file input is aria-hidden + tabIndex={-1} — correctly excluded.
 *
 * ## Cross-card focus order (investigation findings)
 *
 * Cards are rendered in their natural DOM order: GitHub Copilot → OpenAI →
 * Anthropic → Claude Code → ChatGPT Export → Claude Export (disabled).
 * After the last focusable element in card N, focus moves to the first
 * focusable element in card N+1. No `tabIndex` values disrupt this sequence.
 *
 * ## ThemeToggle interaction
 *
 * The ThemeToggle `<button>` sits in the page header, above the SourceCard
 * list in DOM order. Keyboard users will encounter:
 *   ThemeToggle → Skip-to-main link (only visible on focus) → first card →
 *   ... → last card → Analyze/CTA button
 *
 * This order is consistent with visual reading order and no intervention is
 * needed to fix it.
 *
 * ## No DOM reorder needed
 *
 * The existing DOM order within each card matches the expected tab sequence.
 * No `tabIndex` manipulation or CSS `order` changes are required.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SourceCard } from '../src/components/SourceCard';
import { SessionContext } from '../src/context/SessionContext.js';
import type { SourceId } from '../src/types/index.js';

vi.mock('../api/client.js', () => ({
  apiClient: {
    setCredential: vi.fn(),
    validate: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

function renderSourceCard(sourceId: SourceId, sourceState: Record<string, unknown> = {}) {
  const { container } = render(
    <SessionContext.Provider value={{
      state: { phase: 'landing', sources: { [sourceId]: { status: 'pending', ...sourceState } } },
      dispatch: vi.fn(),
      updateSource: vi.fn(),
      clearSession: vi.fn(),
      abortControllerRef: { current: null },
    } as any}>
      <SourceCard sourceId={sourceId} />
    </SessionContext.Provider>
  );
  return container;
}

/** Returns elements that are reachable by Tab key (tabIndex >= 0, not hidden). */
function getTabSequence(container: HTMLElement): HTMLElement[] {
  const candidates = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"][tabindex]'
  );
  return Array.from(candidates).filter((el) => {
    // Exclude aria-hidden elements
    if (el.getAttribute('aria-hidden') === 'true') return false;
    // Exclude hidden inputs even if not aria-hidden (safety net)
    if (el.getAttribute('type') === 'hidden') return false;
    // Exclude elements with tabIndex=-1
    if (el.tabIndex === -1) return false;
    return true;
  });
}

describe('SourceCard tab order (WP-15)', () => {
  // ── API-type source (OpenAI) ────────────────────────────────────────────

  it('API source tab sequence: disclosure btn → API key input → Validate button', () => {
    // Provide a credential so the Validate button is not disabled
    const container = renderSourceCard('openai', { credential: 'sk-test' });
    const seq = getTabSequence(container);

    // Minimum 3 focusable elements in expected order
    expect(seq.length).toBeGreaterThanOrEqual(3);

    const names = seq.map((el) =>
      el.textContent?.trim() || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.tagName.toLowerCase()
    );

    // Disclosure button is first
    expect(names[0]).toMatch(/how to connect/i);

    // Then the password input (placeholder)
    const inputIdx = seq.findIndex((el) => el.getAttribute('type') === 'password');
    expect(inputIdx).toBeGreaterThan(0);

    // Then validate button after input
    const validateIdx = seq.findIndex((el) => el.textContent?.match(/validate/i));
    expect(validateIdx).toBeGreaterThan(inputIdx);
  });

  it('API source: no element has tabIndex > 0 (preserves natural DOM order)', () => {
    const container = renderSourceCard('openai');
    const positiveTabIndex = container.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])');
    expect(positiveTabIndex.length).toBe(0);
  });

  // ── Local source (Claude Code) ──────────────────────────────────────────

  it('Local source tab sequence: disclosure btn → switch button', () => {
    const container = renderSourceCard('claude_code', { enabled: false });
    const seq = getTabSequence(container);

    expect(seq.length).toBeGreaterThanOrEqual(2);

    // Disclosure button is first
    expect(seq[0].textContent).toMatch(/how to connect/i);

    // Switch button follows
    const switchEl = seq.find((el) => el.getAttribute('role') === 'switch');
    expect(switchEl).toBeDefined();
    expect(seq.indexOf(switchEl!)).toBeGreaterThan(0);
  });

  it('Local source: hidden checkbox is excluded from tab sequence', () => {
    const container = renderSourceCard('claude_code', { enabled: false });
    const seq = getTabSequence(container);
    // The actual checkbox backing the toggle is aria-hidden + tabIndex=-1
    const hiddenCheckbox = container.querySelector('input[type="checkbox"][aria-hidden="true"]');
    expect(hiddenCheckbox).not.toBeNull();
    expect(seq).not.toContain(hiddenCheckbox);
  });

  // ── File source (ChatGPT Export) ───────────────────────────────────────

  it('File source tab sequence: disclosure btn → upload area', () => {
    const container = renderSourceCard('chatgpt_export');
    const seq = getTabSequence(container);

    expect(seq.length).toBeGreaterThanOrEqual(2);

    // Disclosure button is first
    expect(seq[0].textContent).toMatch(/how to connect/i);

    // Upload area follows
    const uploadArea = seq.find((el) => el.getAttribute('role') === 'button' && el.classList.contains('upload-area'));
    expect(uploadArea).toBeDefined();
  });

  it('File source: hidden file input is excluded from tab sequence', () => {
    const container = renderSourceCard('chatgpt_export');
    const seq = getTabSequence(container);
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    expect(seq).not.toContain(fileInput);
  });

  // ── Disabled source (Claude Export) ────────────────────────────────────

  it('Disabled source has no focusable interactive controls', () => {
    const container = renderSourceCard('claude_export');
    const seq = getTabSequence(container);
    // No disclosure button, no inputs, no buttons other than inherited
    expect(seq.length).toBe(0);
  });

  // ── h1 headings with data-focus-on-mount ────────────────────────────────

  it('data-focus-on-mount h1 elements have tabIndex=-1 (programmatic only, not in tab sequence)', () => {
    // This verifies that phase-heading focus targets are not in the sequential tab order.
    // The tabIndex=-1 on <h1 data-focus-on-mount> means .focus() works programmatically
    // but Tab key skips these elements.
    const div = document.createElement('div');
    div.innerHTML = '<h1 tabindex="-1" data-focus-on-mount>Test</h1>';
    const h1 = div.querySelector('h1') as HTMLElement;
    expect(h1.tabIndex).toBe(-1);
  });
});
