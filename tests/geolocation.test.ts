import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CANCELLED_CODE,
  startShortCapture,
  type ShortCaptureOptions,
} from '../src/services/geolocation'

const options: ShortCaptureOptions = { timeoutMs: 15_000, maxAgeMs: 3_000, maxAccuracyM: 20 }

type SuccessCallback = (position: GeolocationPosition) => void
type ErrorCallback = (error: GeolocationPositionError) => void

interface FakeGeolocation {
  watchPosition: ReturnType<typeof vi.fn>
  clearWatch: ReturnType<typeof vi.fn>
  emit: (ageMs: number, accuracy: number, latitude?: number) => void
  fail: (code: number) => void
}

function installFakeGeolocation(): FakeGeolocation {
  let onSuccess: SuccessCallback = () => {}
  let onError: ErrorCallback = () => {}
  const watchPosition = vi.fn((success: SuccessCallback, error: ErrorCallback) => {
    onSuccess = success
    onError = error
    return 7
  })
  const clearWatch = vi.fn()
  vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch } })
  return {
    watchPosition,
    clearWatch,
    emit: (ageMs, accuracy, latitude = 40.61) =>
      onSuccess({
        timestamp: Date.now() - ageMs,
        coords: { latitude, longitude: -3.46, accuracy },
      } as GeolocationPosition),
    fail: (code) => onError({ code, message: `error ${code}` } as GeolocationPositionError),
  }
}

describe('startShortCapture', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 12, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('stops at the first fresh and precise position and clears the watch', async () => {
    const geo = installFakeGeolocation()
    const updates: number[] = []
    const capture = startShortCapture(options, (update) => updates.push(update.index))

    geo.emit(60_000, 4) // stale
    geo.emit(500, 35) // coarse
    geo.emit(800, 6) // good
    const result = await capture.result

    expect(result).toMatchObject({ ok: true, fresh: true, accuracy: 6, updates: 3 })
    expect(updates).toEqual([1, 2, 3])
    expect(geo.clearWatch).toHaveBeenCalledWith(7)
  })

  it('at the end of the window returns the most accurate recent position, not fresh', async () => {
    const geo = installFakeGeolocation()
    const capture = startShortCapture(options, () => {})

    geo.emit(1_000, 40, 40.61)
    geo.emit(1_500, 25, 40.62) // the most accurate recent one
    geo.emit(500, 30, 40.63) // the latest, but less accurate
    await vi.advanceTimersByTimeAsync(options.timeoutMs)
    const result = await capture.result

    expect(result).toMatchObject({
      ok: true,
      fresh: false,
      accuracy: 25,
      latitude: 40.62,
      updates: 3,
    })
    expect(geo.clearWatch).toHaveBeenCalledWith(7)
  })

  it('never picks a stale position as the best one', async () => {
    const geo = installFakeGeolocation()
    const capture = startShortCapture(options, () => {})

    geo.emit(30_000, 3, 40.61) // very accurate but stale
    geo.emit(1_000, 50, 40.62) // recent, coarse
    await vi.advanceTimersByTimeAsync(options.timeoutMs)
    const result = await capture.result

    expect(result).toMatchObject({ ok: true, fresh: false, accuracy: 50, latitude: 40.62 })
  })

  it('fails with only_stale when every position was stale', async () => {
    const geo = installFakeGeolocation()
    const capture = startShortCapture(options, () => {})

    geo.emit(30_000, 4)
    geo.emit(31_000, 4, 40.62)
    await vi.advanceTimersByTimeAsync(options.timeoutMs)
    const result = await capture.result

    expect(result).toMatchObject({ ok: false, code: 3, reason: 'only_stale', updates: 2 })
    expect(geo.clearWatch).toHaveBeenCalledWith(7)
  })

  it('fails with no_position when nothing arrives in the window', async () => {
    const geo = installFakeGeolocation()
    const capture = startShortCapture(options, () => {})

    await vi.advanceTimersByTimeAsync(options.timeoutMs)
    const result = await capture.result

    expect(result).toMatchObject({ ok: false, code: 3, reason: 'no_position', updates: 0 })
    expect(geo.clearWatch).toHaveBeenCalledTimes(1)
  })

  it('ends immediately when the permission is denied', async () => {
    const geo = installFakeGeolocation()
    const capture = startShortCapture(options, () => {})

    geo.fail(1)
    const result = await capture.result

    expect(result).toMatchObject({ ok: false, code: 1 })
    expect(geo.clearWatch).toHaveBeenCalledTimes(1)
  })

  it('keeps listening after a position-unavailable error', async () => {
    const geo = installFakeGeolocation()
    const capture = startShortCapture(options, () => {})

    geo.fail(2)
    geo.emit(500, 5)
    const result = await capture.result

    expect(result).toMatchObject({ ok: true, fresh: true })
  })

  it('can be cancelled and clears the watch', async () => {
    const geo = installFakeGeolocation()
    const capture = startShortCapture(options, () => {})

    capture.cancel()
    const result = await capture.result

    expect(result).toMatchObject({ ok: false, code: CANCELLED_CODE })
    expect(geo.clearWatch).toHaveBeenCalledWith(7)
  })

  it('clears the watch only once even if it finishes twice', async () => {
    const geo = installFakeGeolocation()
    const capture = startShortCapture(options, () => {})

    geo.emit(500, 5)
    capture.cancel()
    await capture.result

    expect(geo.clearWatch).toHaveBeenCalledTimes(1)
  })

  it('reports an error when geolocation does not exist', async () => {
    vi.stubGlobal('navigator', {})
    const capture = startShortCapture(options, () => {})

    expect(await capture.result).toMatchObject({ ok: false, code: 0 })
  })
})