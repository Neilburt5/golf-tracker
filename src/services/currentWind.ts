import { normalizeDegrees } from '../domain/geo';
import { parseLiveWind, type LiveWind } from '../domain/liveWind';
import type { CourseCoordinates } from '../domain/types';
import { WeatherServiceError } from './weather';

/**
 * Current wind at the course from Open-Meteo (phase 18, D34, D47, D48).
 * Only the COURSE coordinates are sent, never the user's position. The value is a 10 m grid
 * value, not the wind at the ball. Same error type as the round weather service.
 */

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const DEFAULT_TIMEOUT_MS = 10_000;

const CURRENT_VARIABLES = ['wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'] as const;

export function buildCurrentWindUrl(coordinates: CourseCoordinates): string {
  const params = new URLSearchParams({
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
    current: CURRENT_VARIABLES.join(','),
    wind_speed_unit: 'kmh',
    timeformat: 'unixtime',
  });
  return `${FORECAST_URL}?${params.toString()}`;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(message: string): WeatherServiceError {
  return new WeatherServiceError('invalid_response', message);
}

function requiredNumber(current: JsonObject, key: string): number {
  const value = current[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalid(`current.${key} is missing or not a number`);
  }
  return value;
}

/** A number or an explicit null. A missing key is treated as a malformed response. */
function numberOrNull(current: JsonObject, key: string): number | null {
  const value = current[key];
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalid(`current.${key} is missing or not a number`);
  }
  return value;
}

/**
 * Validates the (untrusted) service response and converts it to a LiveWind.
 * `fetchedAt` is when this device downloaded it (ISO); `observedAt` comes from the service.
 */
export function parseCurrentWindResponse(raw: unknown, fetchedAt: string): LiveWind {
  if (!isObject(raw)) throw invalid('The response is not an object');
  if (raw.error === true) throw invalid('The service reported an error');

  const current = raw.current;
  if (!isObject(current)) throw invalid('The response has no current data');

  const time = requiredNumber(current, 'time');
  const speedKmh = requiredNumber(current, 'wind_speed_10m');
  const direction = numberOrNull(current, 'wind_direction_10m');
  const gust = numberOrNull(current, 'wind_gusts_10m');

  const wind = parseLiveWind({
    observedAt: new Date(time * 1000).toISOString(),
    fetchedAt,
    speedKmh,
    directionDeg: direction === null ? null : normalizeDegrees(direction),
    gustKmh: gust,
  });
  if (!wind) throw invalid('The wind values are out of range');
  return wind;
}

export interface FetchCurrentWindOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Downloads the current wind. Throws WeatherServiceError on any failure. `now` is an ISO time. */
export async function fetchCurrentWind(
  coordinates: CourseCoordinates,
  now: string,
  options: FetchCurrentWindOptions = {},
): Promise<LiveWind> {
  const fetchImpl: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetchImpl(buildCurrentWindUrl(coordinates), { signal: controller.signal });
    } catch {
      throw new WeatherServiceError(
        controller.signal.aborted ? 'timeout' : 'network',
        'The wind request failed',
      );
    }

    if (!response.ok) {
      throw new WeatherServiceError('http', `The weather service answered HTTP ${response.status}`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new WeatherServiceError(
        controller.signal.aborted ? 'timeout' : 'invalid_response',
        'The wind response is not valid JSON',
      );
    }
    return parseCurrentWindResponse(body, now);
  } finally {
    clearTimeout(timer);
  }
}