/**
 * WP-11: Centralised chart colour palette.
 *
 * `getChartColors()` reads from CSS custom properties at runtime so the
 * palette stays in sync with the design token system. If `getComputedStyle`
 * returns an empty value for a token (e.g. in a test/SSR environment), each
 * fallback is a hard-coded OKLCH string that matches the design intent.
 *
 * PDF_EXPORT_COLOR_OVERRIDES is intentionally static: html2canvas renders
 * into an offscreen canvas that does not inherit the live CSS custom
 * properties. These sRGB hex values are maintained separately and must not
 * use `var(--…)` references.
 */

/** Hard-coded OKLCH fallbacks when CSS custom properties are unavailable. */
const FALLBACK_COLORS = [
  'oklch(62% 0.19 270)',   // indigo
  'oklch(60% 0.20 300)',   // purple
  'oklch(65% 0.16 240)',   // blue
  'oklch(68% 0.17 180)',   // teal
  'oklch(70% 0.18 150)',   // green
] as const;

/**
 * Returns an array of 5 chart colours sourced from CSS custom properties,
 * falling back to `FALLBACK_COLORS` when a property is empty or unavailable.
 *
 * @param element - The element to read computed styles from. Defaults to `document.body`.
 */
export function getChartColors(element?: Element): string[] {
  const target =
    element ??
    (typeof document !== 'undefined' ? document.body : null);

  if (!target) return [...FALLBACK_COLORS];

  const computed = getComputedStyle(target);

  return FALLBACK_COLORS.map((fallback, i) => {
    const token = `--chart-color-${i + 1}`;
    const value = computed.getPropertyValue(token).trim();
    return value !== '' ? value : fallback;
  });
}

/**
 * Static sRGB colour overrides used during PDF export via html2canvas.
 *
 * NOTE: These values are intentionally static (not `var(--…)`) because
 * html2canvas renders into an offscreen canvas that does not inherit live
 * CSS custom properties. Any design-token palette changes must be manually
 * reflected here.
 */
export const PDF_EXPORT_COLOR_OVERRIDES = [
  '#6366f1',   // indigo
  '#8b5cf6',   // purple
  '#3b82f6',   // blue
  '#14b8a6',   // teal
  '#22c55e',   // green
] as const;
