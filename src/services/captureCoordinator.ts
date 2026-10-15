import { startShotCapture, type ShotCapture } from './shotCapture';

/**
 * Decides who may use the GPS (phase 18, D32 amendment: bounded windows only, never two
 * competing captures). Two kinds of capture exist:
 * - shot: started by a club tap. It always wins and several can overlap (as before).
 * - live: started by the info panel (screen open, "Actualizar"). At most one at a time, and
 *   never while a shot capture is running.
 *
 * A club tap cancels the running live capture: the shot needs its own fresh position
 * (age <= 3 s), so an older live position could not be reused anyway. The cancelled live
 * capture ends as "interrupted"; callers treat that as silent.
 *
 * The coordinator opens no capture by itself: `start` is injected, so tests use fakes.
 */

export interface CaptureState {
  shotRunning: boolean;
  liveRunning: boolean;
}

export function createCaptureCoordinator(start: () => ShotCapture = startShotCapture) {
  let live: ShotCapture | null = null;
  const shots = new Set<ShotCapture>();
  const listeners = new Set<() => void>();
  let state: CaptureState = { shotRunning: false, liveRunning: false };

  /** Replaces the state object only when something changed (stable for useSyncExternalStore). */
  function refresh(): void {
    const next: CaptureState = { shotRunning: shots.size > 0, liveRunning: live !== null };
    if (next.shotRunning === state.shotRunning && next.liveRunning === state.liveRunning) return;
    state = next;
    listeners.forEach((listener) => listener());
  }

  /** Wraps a capture so its slot is released when it settles, however it ends. */
  function track(capture: ShotCapture, onDone: (self: ShotCapture) => void): ShotCapture {
    const finish = () => {
      onDone(tracked);
      refresh();
    };
    const tracked: ShotCapture = {
      result: capture.result.then(
        (outcome) => {
          finish();
          return outcome;
        },
        (error: unknown) => {
          finish();
          throw error;
        },
      ),
      cancel: capture.cancel,
    };
    return tracked;
  }

  /**
   * Starts the capture of a shot. Call it synchronously from the tap handler (D43): the live
   * capture is cancelled first, then `start` runs in the same call.
   */
  function startShot(): ShotCapture {
    const interrupted = live;
    live = null;
    interrupted?.cancel();

    const tracked = track(start(), (self) => {
      shots.delete(self);
    });
    shots.add(tracked);
    refresh();
    return tracked;
  }

  /**
   * Starts a live capture, or returns null when one is already running or a shot capture is
   * running. Call it synchronously from a tap handler or an effect.
   */
  function startLive(): ShotCapture | null {
    if (live !== null || shots.size > 0) return null;

    const tracked = track(start(), (self) => {
      // A live capture that was already replaced must not free the slot of a newer one.
      if (live === self) live = null;
    });
    live = tracked;
    refresh();
    return tracked;
  }

  /** Cancels the live capture, if any (screen left, page hidden). Shot captures are untouched. */
  function cancelLive(): void {
    const interrupted = live;
    live = null;
    interrupted?.cancel();
    refresh();
  }

  function getState(): CaptureState {
    return state;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { startShot, startLive, cancelLive, getState, subscribe };
}

export type CaptureCoordinator = ReturnType<typeof createCaptureCoordinator>;

/** The instance the app uses. Tests build their own with `createCaptureCoordinator`. */
export const captureCoordinator = createCaptureCoordinator();