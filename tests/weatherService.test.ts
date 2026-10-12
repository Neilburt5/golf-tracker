import { describe, expect, it, vi } from 'vitest';
import { weatherWindow } from '../src/domain/weather';
import {
  buildWeatherUrl,
  fetchWeatherSamples,
  parseHourlyResponse,
} from '../src/services/weather';

const coordinates = { latitude: 40.5, longitude: -3.5 };
const win = weatherWindow({ date: '2026-10-01T08:30:00.000Z', numberOfHoles: 18 })!;
const now = '2026-10-02T00:00:00.000Z';

const body = {
  hourly: {
    time: [1759309200, 1759312800],
    temperature_2m: [18.2, null],
    precipitation: [0, 0.1],
    surface_pressure: [940, 941],
    wind_speed_10m: [10, 12],
    wind_direction_10m: [90, 100],
    wind_gusts_10m: [20, null],
  },
};

const asFetch = (fn: unknown) => fn as unknown as typeof fetch;
const okFetch = (payload: unknown) =>
  asFetch(vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })));

describe('buildWeatherUrl', () => {
  it('uses the forecast API with past_days for recent rounds', () => {
    const url = new URL(buildWeatherUrl(coordinates, win, now));
    expect(url.host).toBe('api.open-meteo.com');
    expect(url.searchParams.get('latitude')).toBe('40.5');
    expect(url.searchParams.get('longitude')).toBe('-3.5');
    expect(url.searchParams.get('timeformat')).toBe('unixtime');
    expect(url.searchParams.get('wind_speed_unit')).toBe('kmh');
    expect(Number(url.searchParams.get('past_days'))).toBeLessThanOrEqual(92);
  });

  it('uses the archive API with dates for old rounds', () => {
    const url = new URL(buildWeatherUrl(coordinates, win, '2027-06-01T00:00:00.000Z'));
    expect(url.host).toBe('archive-api.open-meteo.com');
    expect(url.searchParams.get('start_date')).toBe('2026-10-01');
    expect(url.searchParams.get('end_date')).toBe('2026-10-01');
  });
});

describe('parseHourlyResponse', () => {
  it('converts the response to samples (seconds to ms, nulls kept)', () => {
    const samples = parseHourlyResponse(body);
    expect(samples).toHaveLength(2);
    expect(samples[0].time).toBe(1759309200 * 1000);
    expect(samples[1].temperatureC).toBeNull();
    expect(samples[1].windGustKmh).toBeNull();
  });

  it('rejects malformed responses', () => {
    expect(() => parseHourlyResponse(null)).toThrow();
    expect(() => parseHourlyResponse({ error: true, reason: 'x' })).toThrow();
    expect(() => parseHourlyResponse({ hourly: { time: [1] } })).toThrow();
    expect(() =>
      parseHourlyResponse({ hourly: { ...body.hourly, temperature_2m: ['a', 1] } }),
    ).toThrow();
  });
});

describe('fetchWeatherSamples', () => {
  it('returns samples on success', async () => {
    const samples = await fetchWeatherSamples(coordinates, win, now, { fetchImpl: okFetch(body) });
    expect(samples).toHaveLength(2);
  });

  it('reports an HTTP error', async () => {
    const fetchImpl = asFetch(vi.fn(async () => new Response('x', { status: 500 })));
    await expect(fetchWeatherSamples(coordinates, win, now, { fetchImpl })).rejects.toMatchObject({
      code: 'http',
    });
  });

  it('reports a network error', async () => {
    const fetchImpl = asFetch(
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    await expect(fetchWeatherSamples(coordinates, win, now, { fetchImpl })).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('reports a response that is not JSON', async () => {
    const fetchImpl = asFetch(vi.fn(async () => new Response('not json', { status: 200 })));
    await expect(fetchWeatherSamples(coordinates, win, now, { fetchImpl })).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('times out', async () => {
    const hanging = (_input: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    await expect(
      fetchWeatherSamples(coordinates, win, now, { fetchImpl: asFetch(hanging), timeoutMs: 10 }),
    ).rejects.toMatchObject({ code: 'timeout' });
  });
});