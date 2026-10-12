import type { CourseCoordinates } from '../domain/types';
import {
  chooseWeatherSource,
  type HourlySample,
  type WeatherWindow,
} from '../domain/weather';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const DAY_MS = 86_400_000;
const DEFAULT_TIMEOUT_MS = 10_000;

const HOURLY_VARIABLES = [
  'temperature_2m',
  'precipitation',
  'surface_pressure',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
] as const;

export type WeatherErrorCode = 'network' | 'timeout' | 'http' | 'invalid_response';

export class WeatherServiceError extends Error {
  readonly code: WeatherErrorCode;

  constructor(code: WeatherErrorCode, message: string) {
    super(message);
    this.name = 'WeatherServiceError';
    this.code = code;
  }
}

function utcDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Request URL. Only the COURSE coordinates are sent, never the user's position (D34).
 * Recent rounds use the forecast API with past_days; older ones the archive API (D47).
 * Times come back as unix seconds, so no timezone logic is needed.
 */
export function buildWeatherUrl(
  coordinates: CourseCoordinates,
  window: WeatherWindow,
  now: string,
): string {
  const params = new URLSearchParams({
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
    hourly: HOURLY_VARIABLES.join(','),
    wind_speed_unit: 'kmh',
    timeformat: 'unixtime',
  });

  if (chooseWeatherSource(window, now) === 'forecast') {
    const ageDays = Math.ceil((Date.parse(now) - Date.parse(window.start)) / DAY_MS);
    params.set('past_days', String(Math.min(92, Math.max(0, ageDays) + 1)));
    params.set('forecast_days', '1');
    return `${FORECAST_URL}?${params.toString()}`;
  }

  params.set('start_date', utcDate(window.start));
  params.set('end_date', utcDate(window.end));
  return `${ARCHIVE_URL}?${params.toString()}`;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(message: string): WeatherServiceError {
  return new WeatherServiceError('invalid_response', message);
}

function numberSeries(hourly: JsonObject, key: string, length: number): (number | null)[] {
  const raw = hourly[key];
  if (!Array.isArray(raw) || raw.length !== length) {
    throw invalid(`hourly.${key} is missing or has the wrong length`);
  }
  return raw.map((value: unknown) => {
    if (value === null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    throw invalid(`hourly.${key} contains a non-numeric value`);
  });
}

/** Validates the (untrusted) service response and converts it to domain samples. */
export function parseHourlyResponse(raw: unknown): HourlySample[] {
  if (!isObject(raw)) throw invalid('The response is not an object');
  if (raw.error === true) throw invalid('The service reported an error');

  const hourly = raw.hourly;
  if (!isObject(hourly)) throw invalid('The response has no hourly data');

  const rawTimes = hourly.time;
  if (!Array.isArray(rawTimes)) throw invalid('hourly.time is missing');
  const times = rawTimes.map((value: unknown) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw invalid('hourly.time contains a non-numeric value');
    }
    return value * 1000;
  });

  const temperature = numberSeries(hourly, 'temperature_2m', times.length);
  const precipitation = numberSeries(hourly, 'precipitation', times.length);
  const pressure = numberSeries(hourly, 'surface_pressure', times.length);
  const windSpeed = numberSeries(hourly, 'wind_speed_10m', times.length);
  const windDirection = numberSeries(hourly, 'wind_direction_10m', times.length);
  const windGust = numberSeries(hourly, 'wind_gusts_10m', times.length);

  return times.map((time, index) => ({
    time,
    temperatureC: temperature[index],
    precipitationMm: precipitation[index],
    pressureHpa: pressure[index],
    windSpeedKmh: windSpeed[index],
    windDirectionDeg: windDirection[index],
    windGustKmh: windGust[index],
  }));
}

export interface FetchWeatherOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Downloads the hourly samples for a window. Throws WeatherServiceError on any failure. */
export async function fetchWeatherSamples(
  coordinates: CourseCoordinates,
  window: WeatherWindow,
  now: string,
  options: FetchWeatherOptions = {},
): Promise<HourlySample[]> {
  const fetchImpl: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetchImpl(buildWeatherUrl(coordinates, window, now), {
        signal: controller.signal,
      });
    } catch {
      throw new WeatherServiceError(
        controller.signal.aborted ? 'timeout' : 'network',
        'The weather request failed',
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
        'The weather response is not valid JSON',
      );
    }
    return parseHourlyResponse(body);
  } finally {
    clearTimeout(timer);
  }
}