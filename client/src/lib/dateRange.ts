/**
 * Date-range helpers for the Landing analysis-period picker (Phase 3 Unit A).
 *
 * All helpers operate on local calendar dates and emit ISO `YYYY-MM-DD`
 * strings. Parsing uses local noon to avoid UTC-to-local off-by-one shifts.
 */

export type PeriodMode = 'last_7' | 'last_30' | 'last_60' | 'last_90' | 'ytd' | 'custom';

export interface DateRangeStrings {
  start: string;
  end: string;
}

export const PERIOD_PRESETS: Array<{ id: PeriodMode; label: string; days?: number }> = [
  { id: 'last_7', label: 'Last 7 days', days: 7 },
  { id: 'last_30', label: 'Last 30 days', days: 30 },
  { id: 'last_60', label: 'Last 60 days', days: 60 },
  { id: 'last_90', label: 'Last 90 days', days: 90 },
  { id: 'ytd', label: 'YTD' },
  { id: 'custom', label: 'Custom' },
];

/** Format a Date as a local-calendar `YYYY-MM-DD` string. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a `YYYY-MM-DD` string to a local Date at noon (avoids tz off-by-one). */
export function parseIsoDate(iso: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(`${iso}T12:00:00`);
  return new Date(iso);
}

/** Inclusive N-day window ending today (today counts as day 1). */
export function getLastNDaysRange(days: number, today: Date = new Date()): DateRangeStrings {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

/** Year-to-date: Jan 1 of the current year through today (inclusive). */
export function getYtdRange(today: Date = new Date()): DateRangeStrings {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(today.getFullYear(), 0, 1);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

/** Resolve a preset mode to its concrete date range. `custom` returns empty. */
export function getPresetRange(mode: PeriodMode, today: Date = new Date()): DateRangeStrings {
  switch (mode) {
    case 'last_7': return getLastNDaysRange(7, today);
    case 'last_30': return getLastNDaysRange(30, today);
    case 'last_60': return getLastNDaysRange(60, today);
    case 'last_90': return getLastNDaysRange(90, today);
    case 'ytd': return getYtdRange(today);
    case 'custom':
    default: return { start: '', end: '' };
  }
}

/** Inclusive number of calendar days spanned by a range. 0 if incomplete/invalid. */
export function countInclusiveDays(range: DateRangeStrings): number {
  if (!range.start || !range.end) return 0;
  const start = parseIsoDate(range.start);
  const end = parseIsoDate(range.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / 86400000) + 1;
}

/**
 * Validate a date range for analysis. Returns an error message when invalid,
 * or null when the range is acceptable.
 */
export function validateDateRange(range: DateRangeStrings, today: Date = new Date()): string | null {
  if (!range.start || !range.end) return 'Select both a start and end date.';
  const start = parseIsoDate(range.start);
  const end = parseIsoDate(range.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Enter a valid date range.';
  if (start.getTime() > end.getTime()) return 'Start date must be on or before the end date.';
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  if (end.getTime() > endOfToday.getTime()) return 'End date cannot be in the future.';
  return null;
}
