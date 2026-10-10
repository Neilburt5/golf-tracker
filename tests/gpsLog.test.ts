import { describe, expect, it } from 'vitest'
import {
  distanceMeters,
  errorName,
  formatEntry,
  formatLines,
  formatLocalDateTime,
  formatLog,
  formatSeconds,
  type GpsErrorEntry,
  type GpsEventEntry,
  type GpsFixEntry,
} from '../src/domain/gpsLog'

// Local time on purpose: the log is formatted in the user's time zone.
const T0 = new Date(2026, 9, 10, 14, 5, 9).getTime()

function fix(overrides: Partial<GpsFixEntry> = {}): GpsFixEntry {
  return {
    kind: 'fix',
    id: 'f1',
    label: 'parado',
    requestedAt: T0,
    elapsedMs: 1500,
    fixTimestamp: T0 + 1500 - 2000,
    latitude: 40.4168,
    longitude: -3.7038,
    accuracy: 4.6,
    highAccuracy: true,
    ...overrides,
  }
}

const timeout: GpsErrorEntry = {
  kind: 'error',
  id: 'e1',
  label: 'tras-bloqueo',
  requestedAt: T0,
  elapsedMs: 30_000,
  code: 3,
  message: 'Timeout expired',
  highAccuracy: true,
}

const opened: GpsEventEntry = { kind: 'event', id: 'v1', at: T0, text: 'visibility: hidden' }

describe('distanceMeters', () => {
  it('is 0 for the same point', () => {
    const point = { latitude: 40.4168, longitude: -3.7038 }
    expect(distanceMeters(point, point)).toBe(0)
  })

  it('is about 111.19 m for 0.001 degrees of latitude', () => {
    const a = { latitude: 40.4168, longitude: -3.7038 }
    const b = { latitude: 40.4178, longitude: -3.7038 }
    expect(distanceMeters(a, b)).toBeCloseTo(111.19, 1)
  })

  it('is symmetric', () => {
    const a = { latitude: 40.4168, longitude: -3.7038 }
    const b = { latitude: 40.42, longitude: -3.7 }
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6)
  })
})

describe('errorName', () => {
  it('names the geolocation error codes', () => {
    expect(errorName(0)).toBe('UNSUPPORTED')
    expect(errorName(1)).toBe('PERMISSION_DENIED')
    expect(errorName(2)).toBe('POSITION_UNAVAILABLE')
    expect(errorName(3)).toBe('TIMEOUT')
  })

  it('keeps unknown codes visible', () => {
    expect(errorName(9)).toBe('UNKNOWN_9')
  })
})

describe('formatting helpers', () => {
  it('formats local date and time with zero padding', () => {
    expect(formatLocalDateTime(T0)).toBe('2026-10-10 14:05:09')
    expect(formatLocalDateTime(new Date(2026, 0, 2, 3, 4, 5).getTime())).toBe('2026-01-02 03:04:05')
  })

  it('formats milliseconds as seconds with one decimal', () => {
    expect(formatSeconds(1500)).toBe('1.5 s')
    expect(formatSeconds(30_000)).toBe('30.0 s')
  })
})

describe('formatEntry', () => {
  it('writes a fix with accuracy, elapsed time, age and coordinates', () => {
    const line = formatEntry(fix())
    expect(line).toBe(
      '2026-10-10 14:05:09 | FIX | parado | lat=40.416800 lon=-3.703800 | acc=5 m | ' +
        'elapsed 1.5 s | age 2.0 s | highAccuracy=yes',
    )
  })

  it('adds the distance to the previous fix', () => {
    const previous = fix()
    const current = fix({ id: 'f2', latitude: 40.4178 })
    expect(formatEntry(current, previous)).toContain('| dPrev=111 m')
  })

  it('never shows a negative age', () => {
    const line = formatEntry(fix({ fixTimestamp: T0 + 60_000 }))
    expect(line).toContain('age 0.0 s')
  })

  it('writes errors with a readable code name', () => {
    expect(formatEntry(timeout)).toBe(
      '2026-10-10 14:05:09 | ERROR | tras-bloqueo | TIMEOUT | elapsed 30.0 s | ' +
        'highAccuracy=yes | Timeout expired',
    )
  })

  it('writes events', () => {
    expect(formatEntry(opened)).toBe('2026-10-10 14:05:09 | EVENT | visibility: hidden')
  })
})

describe('formatLines and formatLog', () => {
  it('returns one line per entry, in order', () => {
    const lines = formatLines([fix(), opened, timeout])
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('EVENT')
    expect(lines[2]).toContain('ERROR')
  })

  it('measures the distance to the previous successful fix, skipping events and errors', () => {
    const first = fix({ id: 'f1' })
    const second = fix({ id: 'f2', latitude: 40.4178 })
    const lines = formatLines([first, opened, timeout, second])
    expect(lines[0]).not.toContain('dPrev')
    expect(lines[3]).toContain('dPrev=111 m')
  })

  it('starts the copied log with a header line', () => {
    const text = formatLog([fix()])
    const [header, ...rest] = text.split('\n')
    expect(header).toBe('Golf Tracker GPS field test log')
    expect(rest).toHaveLength(1)
  })

  it('handles an empty log', () => {
    expect(formatLog([])).toBe('Golf Tracker GPS field test log')
  })
})