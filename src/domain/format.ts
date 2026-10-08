const LOCALE = 'es-ES';

/** "+2", "-1", "Par"; undefined when there is no value yet. */
export function formatToPar(value: number | null): string | undefined {
  if (value === null) return undefined;
  if (value === 0) return 'Par';
  return value > 0 ? `+${value}` : `${value}`;
}

/** 0-100 value as "43%"; "—" when there is nothing to divide by. */
export function formatPercentage(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}%`;
}

/** "72,5" (Spanish decimal comma) with a fixed number of digits; "—" when there is no value. */
export function formatDecimal(value: number | null, digits = 1): string {
  if (value === null) return '—';
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** "+5,3", "-1,2", "0,0"; never "-0,0". "—" when there is no value. */
export function formatSignedDecimal(value: number | null, digits = 1): string {
  if (value === null) return '—';
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  const normalized = rounded === 0 ? 0 : rounded; // turns -0 into 0
  const text = formatDecimal(normalized, digits);
  return normalized > 0 ? `+${text}` : text;
}

/** "1 hoyo" / "3 hoyos". */
export function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

/** "3 oct 2026" in local time; "—" for an invalid date. */
export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "3 oct" in local time; "—" for an invalid date. */
export function formatDayMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
}