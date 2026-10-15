import { parseLiveWind, type LiveWind } from '../domain/liveWind';

/**
 * Last known wind per course, in localStorage (phase 18, same pattern as D49).
 * It is device metadata, not golf data: it stays out of the backup and the Excel export.
 * Never throws: if storage is blocked or damaged, the cache simply does not exist.
 */

export const WIND_CACHE_PREFIX = 'golf-tracker:last-wind:';

export type WindStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function windCacheKey(courseId: string): string {
  return `${WIND_CACHE_PREFIX}${courseId}`;
}

function defaultStorage(): WindStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // accessing localStorage can throw when site data is blocked
  }
}

/** The cached wind of a course, or null when there is none or it is not valid. */
export function readCachedWind(
  courseId: string,
  storage: WindStorage | null = defaultStorage(),
): LiveWind | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(windCacheKey(courseId));
    if (raw === null) return null;
    return parseLiveWind(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Stores the wind of a course. Returns false when it could not be stored. */
export function writeCachedWind(
  courseId: string,
  wind: LiveWind,
  storage: WindStorage | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(windCacheKey(courseId), JSON.stringify(wind));
    return true;
  } catch {
    return false;
  }
}