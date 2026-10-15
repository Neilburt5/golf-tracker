import { describe, expect, it } from 'vitest';
import { CANCELLED_CODE } from '../src/services/geolocation';
import { mapCaptureResult, SHOT_CAPTURE_OPTIONS } from '../src/services/shotCapture';

describe('SHOT_CAPTURE_OPTIONS', () => {
  it('uses the D39 limits', () => {
    expect(SHOT_CAPTURE_OPTIONS).toEqual({ timeoutMs: 15_000, maxAgeMs: 3_000, maxAccuracyM: 20 });
  });
});

describe('mapCaptureResult', () => {
  it('maps a position to a fix with an ISO time and its freshness', () => {
    const outcome = mapCaptureResult({
      ok: true,
      latitude: 40.6,
      longitude: -3.47,
      accuracy: 6,
      timestamp: Date.UTC(2026, 9, 15, 9, 0, 0),
      fresh: false,
      updates: 4,
    });
    expect(outcome).toEqual({
      ok: true,
      fix: {
        latitude: 40.6,
        longitude: -3.47,
        accuracy: 6,
        fixedAt: '2026-10-15T09:00:00.000Z',
        fresh: false,
      },
    });
  });

  it('maps every failure to a reason', () => {
    const fail = (code: number, reason?: 'no_position' | 'only_stale') =>
      mapCaptureResult({ ok: false, code, message: '', updates: 0, reason });

    expect(fail(1)).toEqual({ ok: false, reason: 'permission_denied' });
    expect(fail(0)).toEqual({ ok: false, reason: 'unsupported' });
    expect(fail(CANCELLED_CODE)).toEqual({ ok: false, reason: 'interrupted' });
    expect(fail(3, 'only_stale')).toEqual({ ok: false, reason: 'only_stale' });
    expect(fail(3, 'no_position')).toEqual({ ok: false, reason: 'no_position' });
    expect(fail(3)).toEqual({ ok: false, reason: 'no_position' });
  });
});