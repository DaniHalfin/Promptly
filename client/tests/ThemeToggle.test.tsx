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

  it('aria-label is "Light mode" after toggling to light mode', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name: 'Light mode' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Light mode' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('aria-pressed toggles to false after click (light mode) — legacy test updated', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('FIX-9 regression ban: aria-label must NOT contain "Switch to" (action-first pattern banned)', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(__dirname, '../src/components/ThemeToggle.tsx'), 'utf-8');
    expect(src).not.toContain('Switch to light mode');
    expect(src).not.toContain('Switch to dark mode');
  });
});
