import type { GeoPoint } from './types';

/**
 * Pure geometry helpers for live distances and wind (phase 18).
 * `distanceMeters` stays in `gpsLog.ts` and is imported from there.
 */

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/** Brings any angle into the range [0, 360). */
export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Initial bearing from one point to another, in degrees clockwise from north (0 = north,
 * 90 = east). Identical points give 0.
 */
export function bearingDegrees(from: GeoPoint, to: GeoPoint): number {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const dLon = toRadians(to.longitude - from.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return normalizeDegrees(toDegrees(Math.atan2(y, x)));
}