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

describe('W5: ThemeToggle aria-pressed', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders with aria-pressed attribute', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button', { name: /switch to/i });
    expect(btn).toHaveAttribute('aria-pressed');
  });

  it('aria-pressed is true when dark mode is active (default)', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button', { name: /switch to light mode/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('aria-pressed toggles to false after click (light mode)', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });
});
