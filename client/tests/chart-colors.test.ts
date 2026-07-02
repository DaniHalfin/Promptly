/**
 * WP-11: Unit tests for getChartColors().
 *
 * Requirements:
 * - Returns an array of exactly 5 non-empty strings
 * - Does not throw when getComputedStyle returns empty values (fallback works)
 * - Each returned string is a non-empty colour expression
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getChartColors, PDF_EXPORT_COLOR_OVERRIDES } from '../src/lib/chart-colors';

describe('getChartColors (WP-11)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an array of exactly 5 strings', () => {
    const colors = getChartColors();
    expect(colors).toHaveLength(5);
  });

  it('returns all non-empty strings', () => {
    const colors = getChartColors();
    for (const c of colors) {
      expect(typeof c).toBe('string');
      expect(c.length).toBeGreaterThan(0);
    }
  });

  it('does not throw when getComputedStyle returns empty values — uses fallbacks', () => {
    // Mock getComputedStyle to return empty property values
    const originalGetCS = window.getComputedStyle;
    window.getComputedStyle = vi.fn().mockReturnValue({
      getPropertyValue: () => '',
    }) as unknown as typeof getComputedStyle;

    let colors: string[];
    expect(() => { colors = getChartColors(); }).not.toThrow();
    // Falls back to OKLCH constants — non-empty
    expect(colors!).toHaveLength(5);
    expect(colors!.every((c) => c.length > 0)).toBe(true);

    window.getComputedStyle = originalGetCS;
  });

  it('uses CSS property values when getComputedStyle returns them', () => {
    const mockColors = [
      'red', 'green', 'blue', 'orange', 'purple',
    ];
    const originalGetCS = window.getComputedStyle;
    window.getComputedStyle = vi.fn().mockReturnValue({
      getPropertyValue: (prop: string) => {
        const idx = parseInt(prop.replace('--chart-color-', ''), 10) - 1;
        return mockColors[idx] ?? '';
      },
    }) as unknown as typeof getComputedStyle;

    const colors = getChartColors();
    expect(colors).toEqual(mockColors);

    window.getComputedStyle = originalGetCS;
  });

  it('falls back per-slot when some properties are missing', () => {
    const originalGetCS = window.getComputedStyle;
    window.getComputedStyle = vi.fn().mockReturnValue({
      getPropertyValue: (prop: string) => {
        // Only return value for slot 1
        return prop === '--chart-color-1' ? 'cyan' : '';
      },
    }) as unknown as typeof getComputedStyle;

    const colors = getChartColors();
    expect(colors[0]).toBe('cyan');
    // Slots 2-5 should be fallback OKLCH values (non-empty)
    for (let i = 1; i < 5; i++) {
      expect(colors[i].length).toBeGreaterThan(0);
      expect(colors[i]).not.toBe('');
    }

    window.getComputedStyle = originalGetCS;
  });

  it('returns fallback array when document is unavailable', () => {
    // Passing undefined forces the fallback path
    const colors = getChartColors(undefined as any);
    expect(colors).toHaveLength(5);
    expect(colors.every((c) => c.length > 0)).toBe(true);
  });
});

describe('PDF_EXPORT_COLOR_OVERRIDES (WP-11)', () => {
  it('has exactly 5 entries', () => {
    expect(PDF_EXPORT_COLOR_OVERRIDES).toHaveLength(5);
  });

  it('all entries are hex colour strings', () => {
    for (const c of PDF_EXPORT_COLOR_OVERRIDES) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('does not contain var(--...) references — intentionally static for html2canvas', () => {
    for (const c of PDF_EXPORT_COLOR_OVERRIDES) {
      expect(c).not.toContain('var(--');
    }
  });
});
