/**
 * Server-side analysis date-window parsing/validation (Phase 3 Unit A4/E2).
 *
 * Guards direct API calls: invalid ISO strings, reversed windows (start > end),
 * and future end dates all produce a validation error the routes surface as 400.
 */

export interface ParsedDateWindow {
  ok: true;
  startDate?: Date;
  endDate?: Date;
}

export interface DateWindowError {
  ok: false;
  error: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a `YYYY-MM-DD` (or ISO) string to a local Date at noon. */
function parseDate(value: string): Date {
  if (ISO_DATE.test(value)) return new Date(`${value}T12:00:00`);
  return new Date(value);
}

/** Inclusive number of calendar days spanned by an ISO range. 0 if invalid. */
export function countInclusiveDays(startDate?: string, endDate?: string): number {
  if (!startDate || !endDate) return 0;
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / 86400000) + 1;
}

/**
 * Validate an optional analysis window. Missing dates are allowed (no window).
 * When present, both must be valid, start <= end, and end must not be in the future.
 */
export function parseAndValidateDateWindow(
  startDateStr?: string,
  endDateStr?: string,
  now: Date = new Date()
): ParsedDateWindow | DateWindowError {
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (startDateStr != null && startDateStr !== '') {
    startDate = parseDate(startDateStr);
    if (Number.isNaN(startDate.getTime())) return { ok: false, error: `Invalid start date: ${startDateStr}` };
  }
  if (endDateStr != null && endDateStr !== '') {
    endDate = parseDate(endDateStr);
    if (Number.isNaN(endDate.getTime())) return { ok: false, error: `Invalid end date: ${endDateStr}` };
  }

  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    return { ok: false, error: 'Start date must be on or before the end date.' };
  }

  if (endDate) {
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (endDate.getTime() > endOfToday.getTime()) {
      return { ok: false, error: 'End date cannot be in the future.' };
    }
  }

  return { ok: true, startDate, endDate };
}
