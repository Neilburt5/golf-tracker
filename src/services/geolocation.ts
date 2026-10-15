import { fixAgeMs, isAcceptableFix, type CaptureCriteria } from '../domain/gpsCapture'

/**
 * Thin wrapper over navigator.geolocation for the GPS field test (phase 13).
 * `getSingleFix` takes one position per call. `startShortCapture` (phase 13b,
 * D32 amendment) listens for at most a few seconds after a tap and always
 * stops by itself; it is never continuous tracking.
 */

export interface FixOptions {
  highAccuracy: boolean
  timeoutMs: number
  /** 0 = never accept a cached position. */
  maximumAgeMs: number
}

export type FixResult =
  | { ok: true; latitude: number; longitude: number; accuracy: number; timestamp: number }
  | { ok: false; code: number; message: string }

export type GeoPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported'

/**
 * Requests one position. `getCurrentPosition` is called synchronously from the
 * caller's tap, so the iOS permission prompt still sees a user gesture.
 */
export function getSingleFix(options: FixOptions): Promise<FixResult> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ ok: false, code: 0, message: 'navigator.geolocation is not available' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          ok: true,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        }),
      (error) => resolve({ ok: false, code: error.code, message: error.message }),
      {
        enableHighAccuracy: options.highAccuracy,
        timeout: options.timeoutMs,
        maximumAge: options.maximumAgeMs,
      },
    )
  })
}

/** Permission state from the Permissions API, or `unsupported` if it does not answer. */
export async function queryGeolocationPermission(): Promise<GeoPermissionState> {
  try {
    if (!('permissions' in navigator)) return 'unsupported'
    const status = await navigator.permissions.query({ name: 'geolocation' })
    return status.state
  } catch {
    return 'unsupported'
  }
}

/** Code of a capture the user stopped waiting for (not a browser error code). */
export const CANCELLED_CODE = -1

export interface ShortCaptureOptions extends CaptureCriteria {
  /** The window always ends after this time. */
  timeoutMs: number
}

export interface CaptureUpdate {
  index: number
  sinceStartMs: number
  ageMs: number
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

/**
 * Why a window ended without a usable position (only set when it ran out of time):
 * - no_position: nothing arrived at all.
 * - only_stale: positions arrived, but all older than the age limit (D39).
 */
export type CaptureFailureReason = 'no_position' | 'only_stale'

export type ShortCaptureResult =
  | {
      ok: true
      latitude: number
      longitude: number
      accuracy: number
      timestamp: number
      /** true: the position met the age and accuracy criteria. false: best effort at the end of the window. */
      fresh: boolean
      updates: number
    }
  | { ok: false; code: number; message: string; updates: number; reason?: CaptureFailureReason }

export interface ShortCapture {
  result: Promise<ShortCaptureResult>
  /** Stops listening and resolves `result` with `CANCELLED_CODE`. */
  cancel: () => void
}

/**
 * Listens with `watchPosition` until a position is both fresh and precise
 * enough, or until the window ends, and ALWAYS clears the watch before the
 * result is delivered. Every position received is reported to `onUpdate`, so
 * the log shows whether iOS keeps delivering new positions or stays frozen.
 * At the end of the window it returns the MOST ACCURATE position that was not
 * stale (age <= maxAgeMs), marked `fresh: false`; if every position was stale
 * it fails with `reason: 'only_stale'` (D39).
 * Call it synchronously from a tap handler (keeps the user gesture).
 */
export function startShortCapture(
  options: ShortCaptureOptions,
  onUpdate: (update: CaptureUpdate) => void,
): ShortCapture {
  let watchId: number | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let finish: (result: ShortCaptureResult) => void = () => {}
  let updates = 0
  let best: CaptureUpdate | null = null

  const result = new Promise<ShortCaptureResult>((resolve) => {
    let done = false
    finish = (outcome) => {
      if (done) return
      done = true
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      if (timer !== null) clearTimeout(timer)
      resolve(outcome)
    }

    if (!('geolocation' in navigator)) {
      finish({ ok: false, code: 0, message: 'navigator.geolocation is not available', updates: 0 })
      return
    }

    const startedAt = Date.now()

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now()
        updates += 1
        const update: CaptureUpdate = {
          index: updates,
          sinceStartMs: now - startedAt,
          ageMs: fixAgeMs(now, position.timestamp),
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        }
        if (update.ageMs <= options.maxAgeMs && (best === null || update.accuracy < best.accuracy)) {
          best = update
        }
        onUpdate(update)
        if (isAcceptableFix(update.ageMs, update.accuracy, options)) {
          finish({
            ok: true,
            latitude: update.latitude,
            longitude: update.longitude,
            accuracy: update.accuracy,
            timestamp: update.timestamp,
            fresh: true,
            updates,
          })
        }
      },
      (error) => {
        // Only a denied permission ends the window early; other errors may recover.
        if (error.code === 1) finish({ ok: false, code: 1, message: error.message, updates })
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: options.timeoutMs },
    )

    timer = setTimeout(() => {
      if (best) {
        finish({
          ok: true,
          latitude: best.latitude,
          longitude: best.longitude,
          accuracy: best.accuracy,
          timestamp: best.timestamp,
          fresh: false,
          updates,
        })
      } else if (updates > 0) {
        finish({
          ok: false,
          code: 3,
          message: 'Only stale positions in the window',
          updates,
          reason: 'only_stale',
        })
      } else {
        finish({
          ok: false,
          code: 3,
          message: 'No position received in the window',
          updates,
          reason: 'no_position',
        })
      }
    }, options.timeoutMs)
  })

  return {
    result,
    cancel: () =>
      finish({ ok: false, code: CANCELLED_CODE, message: 'cancelled by user', updates }),
  }
}