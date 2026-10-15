import { describe, expect, it } from 'vitest';
import {
  CALM_WIND_KMH,
  WIND_MAX_AGE_MS,
  WIND_REUSE_MS,
  formatWindLine,
  formatWindTime,
  isWindUsable,
  parseLiveWind,
  shouldRefetchWind,
  windAgeMs,
  windComponents,
  type LiveWind,
} from '../src/domain/liveWind';

const NOW = '2026-10-15T12:00:00.000Z';
const nowMs = Date.parse(NOW);
const minutesAgo = (minutes: number) => new Date(nowMs - minutes * 60_000).toISOString();

function wind(overrides: Partial<LiveWind> = {}): LiveWind {
  return {
    observedAt: minutesAgo(5),
    fetchedAt: minutesAgo(2),
    speedKmh: 14,
    directionDeg: 225,
    gustKmh: 22,
    ...overrides,
  };
}

describe('windComponents', () => {
  it('is a full headwind when the wind comes from straight ahead', () => {
    const result = windComponents(20, 0, 0);
    expect(result.headwindKmh).toBeCloseTo(20, 6);
    expect(result.crosswindKmh).toBeCloseTo(0, 6);
  });

  it('is a tailwind (negative) when the wind comes from behind', () => {
    const result = windComponents(20, 180, 0);
    expect(result.headwindKmh).toBeCloseTo(-20, 6);
    expect(result.crosswindKmh).toBeCloseTo(0, 6);
  });

  it('is a positive crosswind when the wind comes from the right', () => {
    // Heading north: the right hand is east.
    const result = windComponents(20, 90, 0);
    expect(result.headwindKmh).toBeCloseTo(0, 6);
    expect(result.crosswindKmh).toBeCloseTo(20, 6);
  });

  it('is a negative crosswind when the wind comes from the left', () => {
    const result = windComponents(20, 270, 0);
    expect(result.crosswindKmh).toBeCloseTo(-20, 6);
  });

  it('follows the heading: facing east, the right hand is south', () => {
    expect(windComponents(10, 180, 90).crosswindKmh).toBeCloseTo(10, 6);
    expect(windComponents(10, 0, 90).crosswindKmh).toBeCloseTo(-10, 6);
  });

  it('splits a diagonal wind evenly', () => {
    // Heading north, wind from the north-east.
    const result = windComponents(20, 45, 0);
    expect(result.headwindKmh).toBeCloseTo(14.142, 2);
    expect(result.crosswindKmh).toBeCloseTo(14.142, 2);
  });

  it('keeps the total speed', () => {
    const result = windComponents(17, 123, 310);
    expect(Math.hypot(result.headwindKmh, result.crosswindKmh)).toBeCloseTo(17, 6);
  });

  it('is zero for no wind', () => {
    const result = windComponents(0, 90, 0);
    expect(result.headwindKmh).toBeCloseTo(0, 6);
    expect(result.crosswindKmh).toBeCloseTo(0, 6);
  });
});

describe('parseLiveWind', () => {
  it('accepts a valid value and drops unknown fields', () => {
    const parsed = parseLiveWind({ ...wind(), extra: 'x' });
    expect(parsed).toEqual(wind());
  });

  it('accepts null direction and null gust', () => {
    expect(parseLiveWind(wind({ directionDeg: null, gustKmh: null }))).toEqual(
      wind({ directionDeg: null, gustKmh: null }),
    );
  });

  it('normalizes a direction of 360 to 0', () => {
    expect(parseLiveWind(wind({ directionDeg: 360 }))?.directionDeg).toBe(0);
  });

  it('rejects anything that is not a wind', () => {
    expect(parseLiveWind(null)).toBeNull();
    expect(parseLiveWind('wind')).toBeNull();
    expect(parseLiveWind({})).toBeNull();
    expect(parseLiveWind(wind({ observedAt: 'yesterday' }))).toBeNull();
    expect(parseLiveWind(wind({ fetchedAt: 'nope' }))).toBeNull();
    expect(parseLiveWind(wind({ speedKmh: -1 }))).toBeNull();
    expect(parseLiveWind(wind({ speedKmh: NaN }))).toBeNull();
    expect(parseLiveWind(wind({ directionDeg: 400 }))).toBeNull();
    expect(parseLiveWind(wind({ directionDeg: -5 }))).toBeNull();
    expect(parseLiveWind(wind({ gustKmh: -3 }))).toBeNull();
    expect(parseLiveWind({ ...wind(), directionDeg: undefined })).toBeNull();
  });
});

describe('shouldRefetchWind', () => {
  it('fetches when there is nothing cached', () => {
    expect(shouldRefetchWind(null, NOW)).toBe(true);
  });

  it('reuses a value fetched less than 10 minutes ago', () => {
    expect(WIND_REUSE_MS).toBe(600_000);
    expect(shouldRefetchWind(wind({ fetchedAt: minutesAgo(9.9) }), NOW)).toBe(false);
  });

  it('fetches again from 10 minutes on', () => {
    expect(shouldRefetchWind(wind({ fetchedAt: minutesAgo(10) }), NOW)).toBe(true);
    expect(shouldRefetchWind(wind({ fetchedAt: minutesAgo(45) }), NOW)).toBe(true);
  });

  it('does not trust a value fetched "in the future"', () => {
    expect(shouldRefetchWind(wind({ fetchedAt: minutesAgo(-30) }), NOW)).toBe(true);
  });
});

describe('isWindUsable', () => {
  it('shows the value for up to 3 hours after its observation time', () => {
    expect(WIND_MAX_AGE_MS).toBe(3 * 3_600_000);
    expect(isWindUsable(wind({ observedAt: minutesAgo(179) }), NOW)).toBe(true);
    expect(isWindUsable(wind({ observedAt: minutesAgo(180) }), NOW)).toBe(true);
    expect(isWindUsable(wind({ observedAt: minutesAgo(181) }), NOW)).toBe(false);
  });

  it('is not usable with an invalid date', () => {
    expect(isWindUsable(wind({ observedAt: 'nope' }), NOW)).toBe(false);
  });

  it('measures the age from the observation time, not from the download', () => {
    const old = wind({ observedAt: minutesAgo(200), fetchedAt: minutesAgo(1) });
    expect(windAgeMs(old, NOW)).toBe(200 * 60_000);
    expect(isWindUsable(old, NOW)).toBe(false);
  });
});

describe('formatWindLine', () => {
  it('shows speed, direction and both components', () => {
    expect(formatWindLine(wind(), { headwindKmh: 11.2, crosswindKmh: -8.4 })).toBe(
      'Viento 14 km/h del SO · de frente 11 · cruzado 8 desde la izquierda',
    );
  });

  it('shows a tailwind and a crosswind from the right', () => {
    expect(formatWindLine(wind(), { headwindKmh: -6.6, crosswindKmh: 7.6 })).toBe(
      'Viento 14 km/h del SO · de cola 7 · cruzado 8 desde la derecha',
    );
  });

  it('omits a component that rounds to zero', () => {
    expect(formatWindLine(wind(), { headwindKmh: 0.3, crosswindKmh: -0.4 })).toBe(
      'Viento 14 km/h del SO',
    );
  });

  it('shows only speed and direction without components', () => {
    expect(formatWindLine(wind(), null)).toBe('Viento 14 km/h del SO');
  });

  it('shows only the speed when there is no direction', () => {
    expect(formatWindLine(wind({ directionDeg: null }), null)).toBe('Viento 14 km/h');
  });

  it('says calm below 1 km/h, whatever the components', () => {
    expect(CALM_WIND_KMH).toBe(1);
    expect(formatWindLine(wind({ speedKmh: 0.6 }), { headwindKmh: 0.5, crosswindKmh: 0.5 })).toBe(
      'Viento en calma',
    );
  });
});

describe('formatWindTime', () => {
  it('formats hours and minutes in local time', () => {
    expect(formatWindTime('2026-10-15T11:45:00.000Z')).toMatch(/^\d{2}:\d{2}$/);
  });

  it('is a dash for an invalid date', () => {
    expect(formatWindTime('nope')).toBe('—');
  });
});