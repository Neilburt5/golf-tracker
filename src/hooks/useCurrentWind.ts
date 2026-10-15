import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isWindUsable, shouldRefetchWind, type LiveWind } from '../domain/liveWind';
import type { CourseCoordinates } from '../domain/types';
import { fetchCurrentWind } from '../services/currentWind';
import { readCachedWind, writeCachedWind } from '../services/windCache';

/**
 * Current wind at the course for the live info panel (phase 18, D34).
 * - Starts from the cached value of the course (localStorage) so something shows offline.
 * - Fetches when the screen opens, when the page becomes visible again and on `refresh()`,
 *   but only if online and the cached value is 10 minutes old or more (`refresh` forces it).
 * - A failure never blocks anything: the last value stays, flagged `failed`.
 * - Only the course coordinates are sent, never the user's position.
 * `nowMs` comes from `useNow`, so the 3 h cutoff is applied without reading the clock here.
 */
export function useCurrentWind(
  courseId: string,
  coordinates: CourseCoordinates | undefined,
  active: boolean,
  nowMs: number,
) {
  const cached = useMemo(() => (courseId ? readCachedWind(courseId) : null), [courseId]);
  const [fetched, setFetched] = useState<{ courseId: string; wind: LiveWind } | null>(null);
  const [failed, setFailed] = useState(false);
  const epochRef = useRef(0);

  const latitude = coordinates?.latitude;
  const longitude = coordinates?.longitude;

  const load = useCallback(
    async (force: boolean) => {
      if (!courseId || latitude === undefined || longitude === undefined) return;

      const epoch = epochRef.current;
      const nowIso = new Date().toISOString();
      if (!force && !shouldRefetchWind(readCachedWind(courseId), nowIso)) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

      try {
        const wind = await fetchCurrentWind({ latitude, longitude }, nowIso);
        if (epoch !== epochRef.current) return;
        writeCachedWind(courseId, wind);
        setFetched({ courseId, wind });
        setFailed(false);
      } catch {
        if (epoch === epochRef.current) setFailed(true);
      }
    },
    [courseId, latitude, longitude],
  );

    useEffect(() => {
    if (!active) return;
    // Started from a timer callback, not from the effect body (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => void load(false), 0);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load(false);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      epochRef.current += 1;
    };
  }, [active, load]);

  const wind = fetched && fetched.courseId === courseId ? fetched.wind : cached;
  const usable = wind && isWindUsable(wind, new Date(nowMs).toISOString()) ? wind : null;

  const refresh = useCallback(() => {
    void load(true);
  }, [load]);

  return { wind: usable, failed, refresh };
}