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