import { describe, expect, it } from 'vitest'
import {
  fixAgeMs,
  formatCaptureUpdate,
  isAcceptableFix,
  type CaptureCriteria,
} from '../src/domain/gpsCapture'

const criteria: CaptureCriteria = { maxAgeMs: 3000, maxAccuracyM: 20 }

describe('fixAgeMs', () => {
  it('is the time between the fix and now', () => {
    expect(fixAgeMs(10_000, 7_500)).toBe(2_500)
  })

  it('never goes negative', () => {
    expect(fixAgeMs(10_000, 12_000)).toBe(0)
  })
})

describe('isAcceptableFix', () => {
  it('accepts a recent and precise fix', () => {
    expect(isAcceptableFix(1_000, 4, criteria)).toBe(true)
  })

  it('accepts the exact limits', () => {
    expect(isAcceptableFix(3_000, 20, criteria)).toBe(true)
  })

  it('rejects a stale fix even when it is precise', () => {
    expect(isAcceptableFix(81_600, 4, criteria)).toBe(false)
  })

  it('rejects a coarse fix even when it is recent', () => {
    expect(isAcceptableFix(500, 35, criteria)).toBe(false)
  })
})

describe('formatCaptureUpdate', () => {
  it('writes the index, time in the window, age, accuracy and position', () => {
    const line = formatCaptureUpdate({
      index: 2,
      sinceStartMs: 1500,
      ageMs: 800,
      accuracy: 12.4,
      latitude: 40.6098,
      longitude: -3.4679,
    })
    expect(line).toBe(
      'window update #2 | +1.5 s | age 0.8 s | acc 12 m | lat=40.609800 lon=-3.467900',
    )
  })
})