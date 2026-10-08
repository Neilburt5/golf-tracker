import { describe, expect, it } from 'vitest';
import {
  formatDayMonth,
  formatDecimal,
  formatPercentage,
  formatShortDate,
  formatSignedDecimal,
  formatToPar,
  plural,
} from '../src/domain/format';

describe('formatDecimal', () => {
  it('uses a decimal comma and the requested digits', () => {
    expect(formatDecimal(72.456)).toBe('72,5');
    expect(formatDecimal(0.3333, 2)).toBe('0,33');
    expect(formatDecimal(2)).toBe('2,0');
  });

  it('returns a dash when there is no value', () => {
    expect(formatDecimal(null)).toBe('—');
  });
});

describe('formatSignedDecimal', () => {
  it('adds a plus sign to positive values only', () => {
    expect(formatSignedDecimal(5.26)).toBe('+5,3');
    expect(formatSignedDecimal(-1.24)).toBe('-1,2');
  });

  it('shows zero without a sign, and never "-0,0"', () => {
    expect(formatSignedDecimal(0)).toBe('0,0');
    expect(formatSignedDecimal(-0.04)).toBe('0,0');
    expect(formatSignedDecimal(0.04)).toBe('0,0');
  });

  it('supports a custom number of digits', () => {
    expect(formatSignedDecimal(0.834, 2)).toBe('+0,83');
  });

  it('returns a dash when there is no value', () => {
    expect(formatSignedDecimal(null)).toBe('—');
  });
});

describe('plural', () => {
  it('uses the singular only for exactly one', () => {
    expect(plural(1, 'hoyo', 'hoyos')).toBe('1 hoyo');
    expect(plural(0, 'hoyo', 'hoyos')).toBe('0 hoyos');
    expect(plural(18, 'hoyo', 'hoyos')).toBe('18 hoyos');
  });
});

describe('date formatting', () => {
  const iso = new Date(2026, 9, 3, 12).toISOString(); // 3 Oct 2026, local noon

  it('formats day, month and year', () => {
    expect(formatShortDate(iso)).toMatch(/^3 oct\.? 2026$/);
  });

  it('formats day and month', () => {
    expect(formatDayMonth(iso)).toMatch(/^3 oct\.?$/);
  });

  it('returns a dash for an invalid date', () => {
    expect(formatShortDate('nope')).toBe('—');
    expect(formatDayMonth('nope')).toBe('—');
  });
});

describe('existing formatters keep working', () => {
  it('formatToPar and formatPercentage', () => {
    expect(formatToPar(0)).toBe('Par');
    expect(formatToPar(2)).toBe('+2');
    expect(formatToPar(-1)).toBe('-1');
    expect(formatToPar(null)).toBeUndefined();
    expect(formatPercentage(43.4)).toBe('43%');
    expect(formatPercentage(null)).toBe('—');
  });
});