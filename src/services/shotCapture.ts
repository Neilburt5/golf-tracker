import type { FixFailureReason } from '../domain/shotFormat';
import type { ShotFix } from '../domain/types';
import {
  CANCELLED_CODE,
  startShortCapture,
  type ShortCaptureOptions,
  type ShortCaptureResult,
} from './geolocation';

/** D39 / D32 amendment: at most 15 s, accept age <= 3 s and accuracy <= 20 m. */
export const SHOT_CAPTURE_OPTIONS: ShortCaptureOptions = {
  timeoutMs: 15_000,
  maxAgeMs: 3_000,
  maxAccuracyM: 20,
};

export type ShotCaptureOutcome =
  | { ok: true; fix: ShotFix }
  | { ok: false; reason: FixFailureReason };

/** Pure mapping from the capture window result to what a shot stores or explains. */
export function mapCaptureResult(result: ShortCaptureResult): ShotCaptureOutcome {
  if (result.ok) {
    return {
      ok: true,
      fix: {
        latitude: result.latitude,
        longitude: result.longitude,
        accuracy: result.accuracy,
        fixedAt: new Date(result.timestamp).toISOString(),
        fresh: result.fresh,
      },
    };
  }
  if (result.code === CANCELLED_CODE) return { ok: false, reason: 'interrupted' };
  if (result.code === 1) return { ok: false, reason: 'permission_denied' };
  if (result.code === 0) return { ok: false, reason: 'unsupported' };
  return { ok: false, reason: result.reason === 'only_stale' ? 'only_stale' : 'no_position' };
}

export interface ShotCapture {
  result: Promise<ShotCaptureOutcome>;
  /** Stops listening; `result` resolves with reason 'interrupted'. */
  cancel: () => void;
}

/**
 * Starts one bounded capture for a shot. Call it synchronously from the tap handler
 * (keeps the user gesture, D43). It always ends by itself (D32 amendment).
 */
export function startShotCapture(): ShotCapture {
  const capture = startShortCapture(SHOT_CAPTURE_OPTIONS, () => {});
  return {
    result: capture.result.then(mapCaptureResult),
    cancel: capture.cancel,
  };
}