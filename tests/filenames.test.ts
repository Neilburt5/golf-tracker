import { describe, expect, it } from 'vitest';
import { localDateStamp, slugify } from '../src/services/filenames';

describe('slugify', () => {
  it('lowercases, strips accents and joins words with dashes', () => {
    expect(slugify('Club de Golf Retamares')).toBe('club-de-golf-retamares');
    expect(slugify('Real Sociedad Hípica Española')).toBe('real-sociedad-hipica-espanola');
  });

  it('removes leading/trailing separators and collapses symbols', () => {
    expect(slugify('  --Golf & Country!!  ')).toBe('golf-country');
  });

  it('returns an empty string when nothing usable is left', () => {
    expect(slugify('???')).toBe('');
  });
});

describe('localDateStamp', () => {
  it('formats a timestamp as YYYY-MM-DD', () => {
    // Midday UTC is the same calendar day in every timezone from UTC-11 to UTC+11.
    expect(localDateStamp('2026-03-01T12:00:00.000Z')).toBe('2026-03-01');
  });

  it('returns the input unchanged when it is not a valid date', () => {
    expect(localDateStamp('not a date')).toBe('not a date');
  });
});