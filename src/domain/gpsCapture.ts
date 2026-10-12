import { formatSeconds } from './gpsLog'

/**
 * Pure helpers for the short capture window (phase 13b, D32 amendment).
 * No React, no browser APIs.
 */

export interface CaptureCriteria {
  /** A position older than this is considered stale. */
  maxAgeMs: number
  /** A position less precise than this is considered coarse. */
  maxAccuracyM: number
}

/** How old a position is when it arrives. Never negative (clock jitter). */
export function fixAgeMs(nowMs: number, fixTimestampMs: number): number {
  return Math.max(0, nowMs - fixTimestampMs)
}

export function isAcceptableFix(
  ageMs: number,
  accuracyM: number,
  criteria: CaptureCriteria,
): boolean {
  return ageMs <= criteria.maxAgeMs && accuracyM <= criteria.maxAccuracyM
}

export interface CaptureUpdateInfo {
  index: number
  sinceStartMs: number
  ageMs: number
  accuracy: number
  latitude: number
  longitude: number
}

/** Text of an event line for each position received inside the window. */
export function formatCaptureUpdate(update: CaptureUpdateInfo): string {
  return (
    `window update #${update.index} | +${formatSeconds(update.sinceStartMs)} | ` +
    `age ${formatSeconds(update.ageMs)} | acc ${Math.round(update.accuracy)} m | ` +
    `lat=${update.latitude.toFixed(6)} lon=${update.longitude.toFixed(6)}`
  )
}