/**
 * Formats a raw token count into a compact, human-readable string.
 *
 * Tiers:
 *   n < 1,000             → exact integer           e.g. "847"
 *   1,000 ≤ n < 1,000,000 → one decimal K           e.g. "142.4K"
 *   1,000,000 ≤ n < 1,000,000,000 → one decimal M   e.g. "934.1M"
 *   n ≥ 1,000,000,000     → one decimal B            e.g. "2.1B"
 */
export function formatTokenCount(n: number): string {
  if (n < 1_000) return n.toString();
  if (n < 1_000_000) return (n / 1_000).toFixed(1) + 'K';
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  return (n / 1_000_000_000).toFixed(1) + 'B';
}
