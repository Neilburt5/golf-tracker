import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { newestFix } from '../domain/holeTargets';
import type { FixFailureReason } from '../domain/shotFormat';
import type { ShotFix } from '../domain/types';
import { captureCoordinator } from '../services/captureCoordinator';
import { queryGeolocationPermission, type GeoPermissionState } from '../services/geolocation';

export type LiveCaptureStatus = 'idle' | 'failed';

interface LiveCaptureState {
  status: LiveCaptureStatus;
  fix: ShotFix | null;
  failure: FixFailureReason | null;
}

/**
 * Position for the live info panel (phase 18). No continuous tracking (D32): one bounded
 * capture when the screen opens (only if the permission is already granted, D43), another
 * when the page becomes visible again (D41) and one per tap on "Actualizar".
 * The coordinator guarantees it never competes with the capture of a club tap: a club tap
 * cancels the live capture, and this hook treats that as silent.
 * The position shown is the newest of its own capture and the last shot fix.
 */
export function useLivePosition(active: boolean, lastShotFix: ShotFix | null) {
  const [permission, setPermission] = useState<GeoPermissionState | null>(null);
  const [capture, setCapture] = useState<LiveCaptureState>({
    status: 'idle',
    fix: null,
    failure: null,
  });

  /** Bumped when the screen is left: late results of old captures are ignored. */
  const epochRef = useRef(0);
  /** Bumped per capture: only the latest capture may update the state. */
  const captureIdRef = useRef(0);
  const wasShotRunningRef = useRef(false);

  const coordinatorState = useSyncExternalStore(
    captureCoordinator.subscribe,
    captureCoordinator.getState,
  );

  /** Must be called synchronously from a tap (keeps the gesture) or after a granted check. */
  const runCapture = useCallback((): boolean => {
    const live = captureCoordinator.startLive();
    if (!live) return false; // a capture is already running, or a shot is being captured

    const epoch = epochRef.current;
    captureIdRef.current += 1;
    const id = captureIdRef.current;
    setCapture((previous) => ({ ...previous, status: 'idle', failure: null }));

    void live.result.then((outcome) => {
      if (epoch !== epochRef.current || id !== captureIdRef.current) return;
      if (outcome.ok) {
        setCapture({ status: 'idle', fix: outcome.fix, failure: null });
      } else if (outcome.reason === 'interrupted') {
        // A club tap or the page going to the background cancelled it: nothing to show.
      } else {
        setCapture((previous) => ({ ...previous, status: 'failed', failure: outcome.reason }));
        if (outcome.reason === 'permission_denied') setPermission('denied');
      }
    });
    return true;
  }, []);

  const refreshPermission = useCallback(async () => {
    const epoch = epochRef.current;
    const state = await queryGeolocationPermission();
    if (epoch === epochRef.current) setPermission(state);
  }, []);

  /** Reads the permission and, only if it is already granted, takes a position. */
  const autoStart = useCallback(async () => {
    const epoch = epochRef.current;
    const state = await queryGeolocationPermission();
    if (epoch !== epochRef.current) return;
    setPermission(state);
    if (state === 'granted') runCapture();
  }, [runCapture]);

  useEffect(() => {
    if (!active) return;
    // Started from a timer callback, not from the effect body (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => void autoStart(), 0);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        captureCoordinator.cancelLive(); // D41: a capture cannot be trusted across a lock
      } else {
        void autoStart();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      epochRef.current += 1;
      captureCoordinator.cancelLive(); // leaving the screen never leaves a watch running
    };
  }, [active, autoStart]);

  // After a shot capture ends the permission may have changed (first prompt answered).
  useEffect(() => {
    const running = coordinatorState.shotRunning;
    if (wasShotRunningRef.current && !running && active) void refreshPermission();
    wasShotRunningRef.current = running;
  }, [coordinatorState.shotRunning, active, refreshPermission]);

  const refresh = useCallback(() => {
    runCapture();
  }, [runCapture]);

  return {
    permission,
    fix: newestFix([capture.fix, lastShotFix]),
    status: capture.status,
    failure: capture.failure,
    /** A live capture is running. */
    capturing: coordinatorState.liveRunning,
    /** A club tap capture is running (the panel updates when its fix lands). */
    shotCapturing: coordinatorState.shotRunning,
    canRefresh:
      active &&
      permission !== 'denied' &&
      !coordinatorState.shotRunning &&
      !coordinatorState.liveRunning,
    refresh,
  };
}