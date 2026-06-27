import { describe, expect, it } from 'vitest';
import { formatTokenCount } from './formatters';

describe('formatTokenCount', () => {
  // Sub-1K — exact integer, no suffix
  it('returns "0" for n=0',   () => expect(formatTokenCount(0)).toBe('0'));
  it('returns "1" for n=1',   () => expect(formatTokenCount(1)).toBe('1'));
  it('returns "999" for n=999', () => expect(formatTokenCount(999)).toBe('999'));

  // Boundary at 1,000
  it('returns "1.0K" for n=1000',  () => expect(formatTokenCount(1_000)).toBe('1.0K'));

  // K tier
  it('returns "142.4K" for n=142400',  () => expect(formatTokenCount(142_400)).toBe('142.4K'));
  it('returns "999.9K" for n=999900',  () => expect(formatTokenCount(999_900)).toBe('999.9K'));

  // Boundary at 1,000,000
  it('returns "1.0M" for n=1000000',  () => expect(formatTokenCount(1_000_000)).toBe('1.0M'));

  // M tier
  it('returns "142.0M" for n=142000000',  () => expect(formatTokenCount(142_000_000)).toBe('142.0M'));
  it('returns "934.1M" for n=934100000',  () => expect(formatTokenCount(934_100_000)).toBe('934.1M'));

  // Boundary at 1,000,000,000
  it('returns "1.0B" for n=1000000000',  () => expect(formatTokenCount(1_000_000_000)).toBe('1.0B'));

  // B tier
  it('returns "2.1B" for n=2100000000',  () => expect(formatTokenCount(2_100_000_000)).toBe('2.1B'));
});
