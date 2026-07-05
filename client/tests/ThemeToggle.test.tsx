/**
 * A2: ThemeToggle touch target — the button must be at least 44×44px.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
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
