import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('PrintLayout PDF safety', () => {
  it('contains no CSS custom property references (var(--*)) — all colors must be hardcoded sRGB for html2canvas', () => {
    const src = readFileSync('src/components/export/PrintLayout.tsx', 'utf-8');
    const matches = src.match(/var\(--[^)]+\)/g) ?? [];
    expect(matches).toHaveLength(0);
    // If this fails, add hardcoded hex equivalents instead of using CSS variables
  });
});
