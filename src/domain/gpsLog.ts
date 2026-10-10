/**
 * Pure helpers for the GPS field test (phase 13). No React, no browser APIs.
 * Times are epoch milliseconds; text output uses local time.
 */

export interface GpsFixEntry {
  kind: 'fix'
  id: string
  label: string
  requestedAt: number
  /** Time between the tap and the answer. */
  elapsedMs: number
  /** `position.timestamp`: when the device says the fix was taken. */
  fixTimestamp: number
  latitude: number
  longitude: number
  accuracy: number
  highAccuracy: boolean
}

export interface GpsErrorEntry {
  kind: 'error'
  id: string
  label: string
  requestedAt: number
  elapsedMs: number
  code: number
  message: string
  highAccuracy: boolean
}

export interface GpsEventEntry {
  kind: 'event'
  id: string
  at: number
  text: string
}

export type GpsLogEntry = GpsFixEntry | GpsErrorEntry | GpsEventEntry

const EARTH_RADIUS_M = 6_371_000

/** Great-circle distance in meters between two coordinates (haversine). */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** GeolocationPositionError codes. 0 means "geolocation not available at all". */
export function errorName(code: number): string {
  switch (code) {
    case 0:
      return 'UNSUPPORTED'
    case 1:
      return 'PERMISSION_DENIED'
    case 2:
      return 'POSITION_UNAVAILABLE'
    case 3:
      return 'TIMEOUT'
    default:
      return `UNKNOWN_${code}`
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** `YYYY-MM-DD HH:MM:SS` in local time. */
export function formatLocalDateTime(ms: number): string {
  const d = new Date(ms)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`
}

export function entryTime(entry: GpsLogEntry): number {
  return entry.kind === 'event' ? entry.at : entry.requestedAt
}

const yesNo = (value: boolean) => (value ? 'yes' : 'no')

/**
 * One line of the copyable log. `previousFix` adds the distance to the previous
 * successful fix, useful to measure jitter while standing still.
 */
export function formatEntry(entry: GpsLogEntry, previousFix?: GpsFixEntry): string {
  const time = formatLocalDateTime(entryTime(entry))
  if (entry.kind === 'event') return `${time} | EVENT | ${entry.text}`

  if (entry.kind === 'error') {
    return (
      `${time} | ERROR | ${entry.label} | ${errorName(entry.code)} | ` +
      `elapsed ${formatSeconds(entry.elapsedMs)} | highAccuracy=${yesNo(entry.highAccuracy)} | ` +
      entry.message
    )
  }

  const age = entry.requestedAt + entry.elapsedMs - entry.fixTimestamp
  const parts = [
    time,
    'FIX',
    entry.label,
    `lat=${entry.latitude.toFixed(6)} lon=${entry.longitude.toFixed(6)}`,
    `acc=${Math.round(entry.accuracy)} m`,
    `elapsed ${formatSeconds(entry.elapsedMs)}`,
    `age ${formatSeconds(Math.max(0, age))}`,
    `highAccuracy=${yesNo(entry.highAccuracy)}`,
  ]
  if (previousFix) parts.push(`dPrev=${Math.round(distanceMeters(previousFix, entry))} m`)
  return parts.join(' | ')
}

/** One text line per entry, same order, so the screen and the copied log agree. */
export function formatLines(entries: GpsLogEntry[]): string[] {
  const lines: string[] = []
  let previousFix: GpsFixEntry | undefined
  for (const entry of entries) {
    lines.push(formatEntry(entry, previousFix))
    if (entry.kind === 'fix') previousFix = entry
  }
  return lines
}

/** Whole log, oldest first, ready to paste into a chat or a note. */
export function formatLog(entries: GpsLogEntry[]): string {
  return ['Golf Tracker GPS field test log', ...formatLines(entries)].join('\n')
}