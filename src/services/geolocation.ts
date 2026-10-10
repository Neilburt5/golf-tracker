/**
 * Thin wrapper over navigator.geolocation for the GPS field test (phase 13).
 * One fix per call (D32): `getCurrentPosition` only, never `watchPosition`.
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