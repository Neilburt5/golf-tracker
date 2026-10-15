import { describe, expect, it, vi } from 'vitest';
import {
  buildCurrentWindUrl,
  fetchCurrentWind,
  parseCurrentWindResponse,
} from '../src/services/currentWind';

const coordinates = { latitude: 40.5, longitude: -3.5 };
const NOW = '2026-10-15T12:00:00.000Z';
const OBSERVED_UNIX = 1760529600;

function body(current: Record<string, unknown> = {}) {
  return {
    current: {
      time: OBSERVED_UNIX,
      interval: 900,
      wind_speed_10m: 14.4,
      wind_direction_10m: 225,
      wind_gusts_10m: 22.3,
      ...current,
    },
  };
}

const asFetch = (fn: unknown) => fn as unknown as typeof fetch;
const okFetch = (payload: unknown) =>
  asFetch(vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })));

describe('buildCurrentWindUrl', () => {
  it('asks the forecast API for the current wind in km/h with unix time', () => {
    const url = new URL(buildCurrentWindUrl(coordinates));
    expect(url.host).toBe('api.open-meteo.com');
    expect(url.pathname).toBe('/v1/forecast');
    expect(url.searchParams.get('current')).toBe('wind_speed_10m,wind_direction_10m,wind_gusts_10m');
    expect(url.searchParams.get('wind_speed_unit')).toBe('kmh');
    expect(url.searchParams.get('timeformat')).toBe('unixtime');
  });

  it('sends only the course coordinates and the wind parameters (D34)', () => {
    const url = new URL(buildCurrentWindUrl(coordinates));
    expect(url.searchParams.get('latitude')).toBe('40.5');
    expect(url.searchParams.get('longitude')).toBe('-3.5');
    expect([...url.searchParams.keys()].sort()).toEqual([
      'current',
      'latitude',
      'longitude',
      'timeformat',
      'wind_speed_unit',
    ]);
  });
});

describe('parseCurrentWindResponse', () => {
  it('converts the response (seconds to ISO) and keeps both times apart', () => {
    expect(parseCurrentWindResponse(body(), NOW)).toEqual({
      observedAt: new Date(OBSERVED_UNIX * 1000).toISOString(),
      fetchedAt: NOW,
      speedKmh: 14.4,
      directionDeg: 225,
      gustKmh: 22.3,
    });
  });

  it('keeps null direction and null gust', () => {
    const wind = parseCurrentWindResponse(
      body({ wind_direction_10m: null, wind_gusts_10m: null }),
      NOW,
    );
    expect(wind.directionDeg).toBeNull();
    expect(wind.gustKmh).toBeNull();
  });

  it('normalizes a direction of 360 to 0', () => {
    expect(parseCurrentWindResponse(body({ wind_direction_10m: 360 }), NOW).directionDeg).toBe(0);
  });

  it('rejects malformed responses', () => {
    expect(() => parseCurrentWindResponse(null, NOW)).toThrow();
    expect(() => parseCurrentWindResponse([], NOW)).toThrow();
    expect(() => parseCurrentWindResponse({ error: true, reason: 'x' }, NOW)).toThrow();
    expect(() => parseCurrentWindResponse({}, NOW)).toThrow();
    expect(() => parseCurrentWindResponse({ current: 'x' }, NOW)).toThrow();
    expect(() => parseCurrentWindResponse(body({ time: '2026-10-15' }), NOW)).toThrow();
    expect(() => parseCurrentWindResponse(body({ time: undefined }), NOW)).toThrow();
    expect(() => parseCurrentWindResponse(body({ wind_speed_10m: undefined }), NOW)).toThrow();
    expect(() => parseCurrentWindResponse(body({ wind_speed_10m: null }), NOW)).toThrow();
    expect(() => parseCurrentWindResponse(body({ wind_speed_10m: -2 }), NOW)).toThrow();
    expect(() => parseCurrentWindResponse(body({ wind_direction_10m: 'SW' }), NOW)).toThrow();
    expect(() => parseCurrentWindResponse(body({ wind_direction_10m: undefined }), NOW)).toThrow();
    expect(() => parseCurrentWindResponse(body({ wind_gusts_10m: undefined }), NOW)).toThrow();
  });

  it('reports malformed responses as invalid_response', () => {
    expect(() => parseCurrentWindResponse({}, NOW)).toThrowError(
      expect.objectContaining({ code: 'invalid_response' }),
    );
  });
});

describe('fetchCurrentWind', () => {
  it('returns the wind on success, with fetchedAt equal to the given time', async () => {
    const wind = await fetchCurrentWind(coordinates, NOW, { fetchImpl: okFetch(body()) });
    expect(wind.speedKmh).toBe(14.4);
    expect(wind.fetchedAt).toBe(NOW);
  });

  it('requests the URL built for the course coordinates', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body()), { status: 200 }));
    await fetchCurrentWind(coordinates, NOW, { fetchImpl: asFetch(fetchImpl) });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((fetchImpl.mock.calls[0] as unknown[])[0]).toBe(buildCurrentWindUrl(coordinates));
  });

  it('reports an HTTP error', async () => {
    const fetchImpl = asFetch(vi.fn(async () => new Response('x', { status: 500 })));
    await expect(fetchCurrentWind(coordinates, NOW, { fetchImpl })).rejects.toMatchObject({
      code: 'http',
    });
  });

  it('reports a network error', async () => {
    const fetchImpl = asFetch(
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    await expect(fetchCurrentWind(coordinates, NOW, { fetchImpl })).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('reports a response that is not JSON', async () => {
    const fetchImpl = asFetch(vi.fn(async () => new Response('not json', { status: 200 })));
    await expect(fetchCurrentWind(coordinates, NOW, { fetchImpl })).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('reports a well-formed JSON with the wrong shape', async () => {
    await expect(
      fetchCurrentWind(coordinates, NOW, { fetchImpl: okFetch({ hourly: {} }) }),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('times out', async () => {
    const hanging = (_input: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    await expect(
      fetchCurrentWind(coordinates, NOW, { fetchImpl: asFetch(hanging), timeoutMs: 10 }),
    ).rejects.toMatchObject({ code: 'timeout' });
  });
});