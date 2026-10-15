import { describe, expect, it } from 'vitest';
import { bearingDegrees, normalizeDegrees } from '../src/domain/geo';

describe('normalizeDegrees', () => {
  it('keeps angles in [0, 360)', () => {
    expect(normalizeDegrees(0)).toBe(0);
    expect(normalizeDegrees(359)).toBe(359);
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(450)).toBe(90);
    expect(normalizeDegrees(-90)).toBe(270);
    expect(normalizeDegrees(-360)).toBe(0);
  });
});

describe('bearingDegrees', () => {
  const origin = { latitude: 0, longitude: 0 };

  it('gives the four cardinal directions', () => {
    expect(bearingDegrees(origin, { latitude: 1, longitude: 0 })).toBeCloseTo(0, 5);
    expect(bearingDegrees(origin, { latitude: 0, longitude: 1 })).toBeCloseTo(90, 5);
    expect(bearingDegrees(origin, { latitude: -1, longitude: 0 })).toBeCloseTo(180, 5);
    expect(bearingDegrees(origin, { latitude: 0, longitude: -1 })).toBeCloseTo(270, 5);
  });

  it('gives about 45 degrees to the north-east on a short distance', () => {
    expect(bearingDegrees(origin, { latitude: 0.001, longitude: 0.001 })).toBeCloseTo(45, 1);
  });

  it('works at the latitude of the course', () => {
    const from = { latitude: 40.6, longitude: -3.47 };
    // Due north and due east of the point.
    expect(bearingDegrees(from, { latitude: 40.601, longitude: -3.47 })).toBeCloseTo(0, 3);
    expect(bearingDegrees(from, { latitude: 40.6, longitude: -3.469 })).toBeCloseTo(90, 1);
  });

  it('is 0 for identical points', () => {
    expect(bearingDegrees(origin, origin)).toBe(0);
  });
});