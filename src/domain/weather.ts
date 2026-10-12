import type { Round, RoundWeather } from './types';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Rounds started less than this many days ago use the forecast API (its past_days limit is 92). */
export const FORECAST_MAX_AGE_DAYS = 85;

/** One hourly slot returned by the weather service. null = the service had no value. */
export interface HourlySample {
  /** Slot timestamp, epoch ms UTC. Precipitation is the sum of the PRECEDING hour. */
  time: number;
  temperatureC: number | null;
  precipitationMm: number | null;
  pressureHpa: number | null;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
  windGustKmh: number | null;
}

export interface WeatherWindow {
  start: string; // ISO UTC, on the hour
  end: string; // ISO UTC
  hours: number;
}

export type WeatherSource = 'forecast' | 'archive';

export type WeatherSummary = Omit<
  RoundWeather,
  'roundId' | 'source' | 'latitude' | 'longitude' | 'windowStart' | 'windowEnd' | 'fetchedAt'
>;

/**
 * Window of the round (D44): from the hour of round.date, 5 h for 18 holes and 3 h for 9.
 * Deterministic: it does not depend on updatedAt, because finished rounds stay editable.
 */
export function weatherWindow(round: Pick<Round, 'date' | 'numberOfHoles'>): WeatherWindow | null {
  const startMs = Date.parse(round.date);
  if (Number.isNaN(startMs)) return null;
  const hourStart = Math.floor(startMs / HOUR_MS) * HOUR_MS;
  const hours = round.numberOfHoles === 18 ? 5 : 3;
  return {
    start: new Date(hourStart).toISOString(),
    end: new Date(hourStart + hours * HOUR_MS).toISOString(),
    hours,
  };
}

/** Weather is only fetched once the window has passed, so the data is not a forecast. */
export function isWindowOver(window: WeatherWindow, now: string): boolean {
  return Date.parse(now) >= Date.parse(window.end);
}

export function chooseWeatherSource(window: WeatherWindow, now: string): WeatherSource {
  const ageDays = (Date.parse(now) - Date.parse(window.start)) / DAY_MS;
  return ageDays < FORECAST_MAX_AGE_DAYS ? 'forecast' : 'archive';
}

function values(samples: readonly HourlySample[], pick: (s: HourlySample) => number | null): number[] {
  const result: number[] = [];
  for (const sample of samples) {
    const value = pick(sample);
    if (value !== null) result.push(value);
  }
  return result;
}

function mean(list: readonly number[]): number | null {
  if (list.length === 0) return null;
  return list.reduce((total, value) => total + value, 0) / list.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Wind-speed weighted vector mean of the directions. Null when calm or cancelling out. */
function meanWindDirection(samples: readonly HourlySample[]): number | null {
  let x = 0;
  let y = 0;
  for (const sample of samples) {
    if (sample.windDirectionDeg === null || sample.windSpeedKmh === null) continue;
    const radians = (sample.windDirectionDeg * Math.PI) / 180;
    x += sample.windSpeedKmh * Math.sin(radians);
    y += sample.windSpeedKmh * Math.cos(radians);
  }
  if (Math.hypot(x, y) < 1e-6) return null;
  const degrees = (Math.atan2(x, y) * 180) / Math.PI;
  return Math.round((degrees + 360) % 360) % 360;
}

/**
 * Aggregates the slots with start < time <= end (precipitation of a slot covers the hour before it).
 * Returns null when there is not enough data (no slots, or a metric without any value).
 */
export function summarizeWeather(
  samples: readonly HourlySample[],
  window: WeatherWindow,
): WeatherSummary | null {
  const startMs = Date.parse(window.start);
  const endMs = Date.parse(window.end);
  const slots = samples.filter((sample) => sample.time > startMs && sample.time <= endMs);
  if (slots.length === 0) return null;

  const temperature = mean(values(slots, (s) => s.temperatureC));
  const pressure = mean(values(slots, (s) => s.pressureHpa));
  const windSpeed = mean(values(slots, (s) => s.windSpeedKmh));
  const precipitation = values(slots, (s) => s.precipitationMm);
  const gusts = values(slots, (s) => s.windGustKmh);

  if (temperature === null || pressure === null || windSpeed === null || precipitation.length === 0) {
    return null;
  }

  return {
    hours: slots.length,
    temperatureC: round1(temperature),
    precipitationMm: round1(precipitation.reduce((total, value) => total + value, 0)),
    pressureHpa: round1(pressure),
    windSpeedKmh: round1(windSpeed),
    windDirectionDeg: meanWindDirection(slots),
    windGustKmh: gusts.length > 0 ? round1(Math.max(...gusts)) : null,
  };
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const;

/** Compass point (Spanish) of a direction in degrees. */
export function compassDirection(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  return COMPASS[Math.round(normalized / 45) % 8];
}

function formatNumber(value: number): string {
  return value.toLocaleString('es-ES', { maximumFractionDigits: 1 });
}

function windText(weather: RoundWeather): string {
  const from =
    weather.windDirectionDeg === null ? '' : ` del ${compassDirection(weather.windDirectionDeg)}`;
  return `viento ${formatNumber(weather.windSpeedKmh)} km/h${from}`;
}

/** "18,5 °C · 0 mm · 945 hPa · viento 12 km/h del SO" */
export function formatWeatherLine(weather: RoundWeather): string {
  return [
    `${formatNumber(weather.temperatureC)} °C`,
    `${formatNumber(weather.precipitationMm)} mm`,
    `${formatNumber(weather.pressureHpa)} hPa`,
    windText(weather),
  ].join(' · ');
}

/** "18,5 °C · viento 12 km/h del SO" (for lists) */
export function formatWeatherShort(weather: RoundWeather): string {
  return `${formatNumber(weather.temperatureC)} °C · ${windText(weather)}`;
}