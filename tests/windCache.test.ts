import { describe, expect, it } from 'vitest';
import type { LiveWind } from '../src/domain/liveWind';
import {
  WIND_CACHE_PREFIX,
  readCachedWind,
  windCacheKey,
  writeCachedWind,
  type WindStorage,
} from '../src/services/windCache';

function wind(overrides: Partial<LiveWind> = {}): LiveWind {
  return {
    observedAt: '2026-10-15T11:45:00.000Z',
    fetchedAt: '2026-10-15T11:50:00.000Z',
    speedKmh: 14,
    directionDeg: 225,
    gustKmh: 22,
    ...overrides,
  };
}

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: WindStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
  return { storage, data };
}

const throwingStorage: WindStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
};

describe('windCacheKey', () => {
  it('has one key per course under the app prefix', () => {
    expect(windCacheKey('retamares-18')).toBe(`${WIND_CACHE_PREFIX}retamares-18`);
    expect(windCacheKey('a')).not.toBe(windCacheKey('b'));
  });
});

describe('readCachedWind / writeCachedWind', () => {
  it('stores a wind and reads it back', () => {
    const { storage } = fakeStorage();
    expect(writeCachedWind('retamares-18', wind(), storage)).toBe(true);
    expect(readCachedWind('retamares-18', storage)).toEqual(wind());
  });

  it('keeps each course apart', () => {
    const { storage } = fakeStorage();
    writeCachedWind('a', wind({ speedKmh: 5 }), storage);
    writeCachedWind('b', wind({ speedKmh: 30 }), storage);
    expect(readCachedWind('a', storage)?.speedKmh).toBe(5);
    expect(readCachedWind('b', storage)?.speedKmh).toBe(30);
  });

  it('replaces the previous value of the same course', () => {
    const { storage } = fakeStorage();
    writeCachedWind('a', wind({ speedKmh: 5 }), storage);
    writeCachedWind('a', wind({ speedKmh: 9 }), storage);
    expect(readCachedWind('a', storage)?.speedKmh).toBe(9);
  });

  it('is null when nothing is stored', () => {
    expect(readCachedWind('a', fakeStorage().storage)).toBeNull();
  });

  it('is null for corrupt JSON', () => {
    const { storage } = fakeStorage({ [windCacheKey('a')]: '{not json' });
    expect(readCachedWind('a', storage)).toBeNull();
  });

  it('is null for JSON with the wrong shape', () => {
    const { storage } = fakeStorage({
      [windCacheKey('a')]: JSON.stringify({ speedKmh: 'fast' }),
      [windCacheKey('b')]: JSON.stringify(null),
      [windCacheKey('c')]: JSON.stringify(wind({ speedKmh: -3 })),
    });
    expect(readCachedWind('a', storage)).toBeNull();
    expect(readCachedWind('b', storage)).toBeNull();
    expect(readCachedWind('c', storage)).toBeNull();
  });

  it('drops unknown fields when reading', () => {
    const { storage } = fakeStorage({
      [windCacheKey('a')]: JSON.stringify({ ...wind(), extra: 'x' }),
    });
    expect(readCachedWind('a', storage)).toEqual(wind());
  });

  it('never throws when the storage does', () => {
    expect(readCachedWind('a', throwingStorage)).toBeNull();
    expect(writeCachedWind('a', wind(), throwingStorage)).toBe(false);
  });

  it('works without any storage', () => {
    expect(readCachedWind('a', null)).toBeNull();
    expect(writeCachedWind('a', wind(), null)).toBe(false);
  });
});