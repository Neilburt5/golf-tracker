import { describe, expect, it, vi } from 'vitest';
import { createCaptureCoordinator } from '../src/services/captureCoordinator';
import type { ShotCapture, ShotCaptureOutcome } from '../src/services/shotCapture';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const FIX_OUTCOME: ShotCaptureOutcome = {
  ok: true,
  fix: {
    latitude: 40.6,
    longitude: -3.47,
    accuracy: 5,
    fixedAt: '2026-10-15T10:00:00.000Z',
    fresh: true,
  },
};
const INTERRUPTED: ShotCaptureOutcome = { ok: false, reason: 'interrupted' };

interface Fake {
  capture: ShotCapture;
  settle: (outcome: ShotCaptureOutcome) => void;
  cancel: ReturnType<typeof vi.fn>;
}

/** A controllable capture. By default `cancel` settles it as interrupted, like the real one. */
function fakeCapture(settleOnCancel = true): Fake {
  let settle: (outcome: ShotCaptureOutcome) => void = () => {};
  const result = new Promise<ShotCaptureOutcome>((resolve) => {
    settle = resolve;
  });
  const cancel = vi.fn(() => {
    if (settleOnCancel) settle(INTERRUPTED);
  });
  return { capture: { result, cancel }, settle: (outcome) => settle(outcome), cancel };
}

/** A coordinator whose `start` hands out the given fakes in order. */
function setup(...fakes: Fake[]) {
  const queue = [...fakes];
  const start = vi.fn(() => {
    const next = queue.shift();
    if (!next) throw new Error('no fake capture left');
    return next.capture;
  });
  return { start, coordinator: createCaptureCoordinator(start) };
}

describe('live capture', () => {
  it('starts and reports it running, then frees the slot when it ends', async () => {
    const live = fakeCapture();
    const { coordinator, start } = setup(live);

    const capture = coordinator.startLive();
    expect(capture).not.toBeNull();
    expect(start).toHaveBeenCalledTimes(1);
    expect(coordinator.getState()).toEqual({ shotRunning: false, liveRunning: true });

    live.settle(FIX_OUTCOME);
    expect(await capture!.result).toEqual(FIX_OUTCOME);
    expect(coordinator.getState()).toEqual({ shotRunning: false, liveRunning: false });
  });

  it('refuses a second live capture while one is running', () => {
    const { coordinator, start } = setup(fakeCapture(), fakeCapture());

    expect(coordinator.startLive()).not.toBeNull();
    expect(coordinator.startLive()).toBeNull();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('allows a new live capture after the previous one ended', async () => {
    const first = fakeCapture();
    const { coordinator, start } = setup(first, fakeCapture());

    const capture = coordinator.startLive();
    first.settle(FIX_OUTCOME);
    await capture!.result;

    expect(coordinator.startLive()).not.toBeNull();
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('can be cancelled, which frees the slot at once', async () => {
    const live = fakeCapture();
    const { coordinator } = setup(live);

    const capture = coordinator.startLive();
    coordinator.cancelLive();

    expect(live.cancel).toHaveBeenCalledTimes(1);
    expect(coordinator.getState().liveRunning).toBe(false);
    expect(await capture!.result).toEqual(INTERRUPTED);
  });

  it('cancelLive does nothing when there is no live capture', () => {
    const { coordinator, start } = setup();
    expect(() => coordinator.cancelLive()).not.toThrow();
    expect(start).not.toHaveBeenCalled();
  });
});

describe('shot capture', () => {
  it('starts straight away and reports it running', async () => {
    const shot = fakeCapture();
    const { coordinator, start } = setup(shot);

    const capture = coordinator.startShot();
    expect(start).toHaveBeenCalledTimes(1);
    expect(coordinator.getState()).toEqual({ shotRunning: true, liveRunning: false });

    shot.settle(FIX_OUTCOME);
    expect(await capture.result).toEqual(FIX_OUTCOME);
    expect(coordinator.getState().shotRunning).toBe(false);
  });

  it('cancels the running live capture and starts its own in the same call', async () => {
    const live = fakeCapture();
    const shot = fakeCapture();
    const { coordinator, start } = setup(live, shot);

    const liveCapture = coordinator.startLive();
    coordinator.startShot();

    expect(live.cancel).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(2);
    // The live capture is cancelled BEFORE the shot capture starts.
    expect(live.cancel.mock.invocationCallOrder[0]).toBeLessThan(
      start.mock.invocationCallOrder[1],
    );
    expect(coordinator.getState()).toEqual({ shotRunning: true, liveRunning: false });
    expect(await liveCapture!.result).toEqual(INTERRUPTED);
  });

  it('does not touch anything when no live capture is running', () => {
    const shot = fakeCapture();
    const { coordinator } = setup(shot);
    coordinator.startShot();
    expect(shot.cancel).not.toHaveBeenCalled();
  });

  it('refuses a live capture while a shot capture runs and allows it afterwards', async () => {
    const shot = fakeCapture();
    const { coordinator, start } = setup(shot, fakeCapture());

    const capture = coordinator.startShot();
    expect(coordinator.startLive()).toBeNull();
    expect(start).toHaveBeenCalledTimes(1);

    shot.settle(FIX_OUTCOME);
    await capture.result;

    expect(coordinator.startLive()).not.toBeNull();
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('keeps live captures out until every overlapping shot capture has ended', async () => {
    const first = fakeCapture();
    const second = fakeCapture();
    const { coordinator } = setup(first, second, fakeCapture());

    const a = coordinator.startShot();
    const b = coordinator.startShot();

    first.settle(FIX_OUTCOME);
    await a.result;
    expect(coordinator.getState().shotRunning).toBe(true);
    expect(coordinator.startLive()).toBeNull();

    second.settle(FIX_OUTCOME);
    await b.result;
    expect(coordinator.getState().shotRunning).toBe(false);
    expect(coordinator.startLive()).not.toBeNull();
  });

  it('passes cancel through and frees the slot', async () => {
    const shot = fakeCapture();
    const { coordinator } = setup(shot);

    const capture = coordinator.startShot();
    capture.cancel();

    expect(shot.cancel).toHaveBeenCalledTimes(1);
    expect(await capture.result).toEqual(INTERRUPTED);
    expect(coordinator.getState().shotRunning).toBe(false);
  });
});

describe('a replaced live capture', () => {
  it('never frees the slot of a newer live capture', async () => {
    // A is cancelled by a shot but only settles later (cancel does not settle it here).
    const a = fakeCapture(false);
    const shot = fakeCapture();
    const b = fakeCapture();
    const { coordinator } = setup(a, shot, b);

    coordinator.startLive();
    const shotCapture = coordinator.startShot();
    shot.settle(FIX_OUTCOME);
    await shotCapture.result;

    expect(coordinator.startLive()).not.toBeNull(); // B
    expect(coordinator.getState().liveRunning).toBe(true);

    a.settle(INTERRUPTED); // the old capture finally ends
    await flush();

    expect(coordinator.getState().liveRunning).toBe(true); // B is still running
  });
});

describe('state subscription', () => {
  it('notifies on every change and keeps the same state object otherwise', async () => {
    const live = fakeCapture();
    const { coordinator } = setup(live);
    const listener = vi.fn();
    coordinator.subscribe(listener);

    const before = coordinator.getState();
    expect(coordinator.getState()).toBe(before);

    const capture = coordinator.startLive();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(coordinator.getState()).not.toBe(before);

    live.settle(FIX_OUTCOME);
    await capture!.result;
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('notifies once when a shot replaces a live capture', () => {
    const { coordinator } = setup(fakeCapture(), fakeCapture());
    coordinator.startLive();

    const listener = vi.fn();
    coordinator.subscribe(listener);
    coordinator.startShot();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(coordinator.getState()).toEqual({ shotRunning: true, liveRunning: false });
  });

  it('stops notifying after unsubscribe', () => {
    const { coordinator } = setup(fakeCapture());
    const listener = vi.fn();
    const unsubscribe = coordinator.subscribe(listener);

    unsubscribe();
    coordinator.startLive();

    expect(listener).not.toHaveBeenCalled();
  });
});