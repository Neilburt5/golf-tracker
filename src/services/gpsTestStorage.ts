import type { GpsLogEntry } from '../domain/gpsLog'

/**
 * Keeps the GPS test log in localStorage (not in the database, which is out of
 * scope for phase 13). It survives iOS suspending or reloading the page, which
 * is exactly what the field test needs to observe.
 */
const KEY = 'golf-tracker.gpsTestLog'

function isLogEntry(value: unknown): value is GpsLogEntry {
  if (typeof value !== 'object' || value === null) return false
  const kind = (value as { kind?: unknown }).kind
  return kind === 'fix' || kind === 'error' || kind === 'event'
}

export function loadStoredLog(): GpsLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isLogEntry) : []
  } catch {
    return []
  }
}

export function saveStoredLog(entries: GpsLogEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    // Storage may be blocked or full; the on-screen log still works.
  }
}