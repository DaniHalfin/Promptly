/**
 * A2: ThemeToggle touch target — the button must be at least 44×44px.
 * W5: ThemeToggle aria-pressed — toggle button must communicate pressed state.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeToggle } from '../src/components/ThemeToggle';

describe('ThemeToggle — A2 touch target', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders a 44×44px button meeting the touch target minimum', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toHaveStyle({
      width: '44px',
      height: '44px',
      minWidth: '44px',
      minHeight: '44px',
    });
  });
});

describe('FIX-9 / W5: ThemeToggle aria-label describes current state (not next action)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders with aria-pressed attribute', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed');
  });

  it('aria-label is "Dark mode" when dark mode is active (default)', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button', { name: 'Dark mode' });
    expect(btn).toBeInTheDocument();
  });

  it('aria-label stays "Dark mode" (fixed) after toggling to light mode — ARIA 1.1', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    // Label must NOT change — only aria-pressed changes
    expect(screen.getByRole('button', { name: 'Dark mode' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Light mode' })).not.toBeInTheDocument();
  });

  it('aria-pressed is true when dark mode is active', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button', { name: 'Dark mode' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('aria-pressed is false when light mode is active', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('aria-pressed toggles to false after click (light mode) — legacy test updated', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('FIX-9 regression ban: aria-label must NOT contain "Switch to" — LS-7 behavioral', () => {
    // LS-7: behavioral — render and assert the DOM attribute is not "Switch to ..."
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).not.toMatch(/Switch to/i);
    // After clicking (light mode), label still must not be "Switch to ..."
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-label')).not.toMatch(/Switch to/i);
  });

  it('ISSUE-C regression ban: aria-label is never "Light mode" — LS-7 behavioral', () => {
    // LS-7: behavioral — fixed label "Dark mode" must be present at all times
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    // Initial state: dark mode active
    expect(btn).toHaveAttribute('aria-label', 'Dark mode');
    // After toggling to light mode: label must STILL be "Dark mode" (fixed label pattern)
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-label', 'Dark mode');
    expect(btn).not.toHaveAttribute('aria-label', 'Light mode');
  });
});
