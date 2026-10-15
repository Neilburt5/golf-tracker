import { normalizeDegrees } from './geo';
import { compassDirection } from './weather';

/**
 * Live wind rules (phase 18): staleness, cache validation, headwind/crosswind and text.
 * Wind is a 10 m grid value, not the wind at the ball (D34). No React, no browser APIs.
 */

/** A cached value fetched less than this long ago is reused (the source updates about every 15 min). */
export const WIND_REUSE_MS = 10 * 60_000;

/** The last known wind is shown for at most this long after its observation time. */
export const WIND_MAX_AGE_MS = 3 * 3_600_000;

/** Below this speed the wind is shown as calm and no components are computed. */
export const CALM_WIND_KMH = 1;

export interface LiveWind {
  /** ISO UTC: the time of the value, as reported by the service. */
  observedAt: string;
  /** ISO UTC: when this device downloaded it. */
  fetchedAt: string;
  speedKmh: number;
  /** Direction the wind comes FROM, 0-359. Null when the service gave none. */
  directionDeg: number | null;
  gustKmh: number | null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/**
 * Validates an untrusted value (the localStorage cache) and returns a clean LiveWind,
 * dropping unknown fields. Null when it is not a valid wind.
 */
export function parseLiveWind(value: unknown): LiveWind | null {
  if (typeof value !== 'object' || value === null) return null;
  const { observedAt, fetchedAt, speedKmh, directionDeg, gustKmh } = value as Record<
    string,
    unknown
  >;

  if (!isDateString(observedAt) || !isDateString(fetchedAt)) return null;
  if (!isFiniteNumber(speedKmh) || speedKmh < 0) return null;
  if (directionDeg !== null && (!isFiniteNumber(directionDeg) || directionDeg < 0 || directionDeg > 360)) {
    return null;
  }
  if (gustKmh !== null && (!isFiniteNumber(gustKmh) || gustKmh < 0)) return null;

  return {
    observedAt,
    fetchedAt,
    speedKmh,
    directionDeg: directionDeg === null ? null : normalizeDegrees(directionDeg),
    gustKmh,
  };
}

/** Age of the value, measured from the time it describes. NaN for an invalid date. */
export function windAgeMs(wind: Pick<LiveWind, 'observedAt'>, now: string): number {
  return Date.parse(now) - Date.parse(wind.observedAt);
}

/** True when there is no cached value, or it was downloaded 10 minutes ago or more. */
export function shouldRefetchWind(wind: LiveWind | null, now: string): boolean {
  if (!wind) return true;
  const sinceFetch = Date.parse(now) - Date.parse(wind.fetchedAt);
  if (Number.isNaN(sinceFetch) || sinceFetch < 0) return true; // clock went backwards: do not trust it
  return sinceFetch >= WIND_REUSE_MS;
}

/** The value is still worth showing (at most 3 h after its observation time). */
export function isWindUsable(wind: LiveWind, now: string): boolean {
  const age = windAgeMs(wind, now);
  return !Number.isNaN(age) && age <= WIND_MAX_AGE_MS;
}

export interface WindComponents {
  /** Positive: wind against the player. Negative: tailwind. */
  headwindKmh: number;
  /** Positive: wind coming from the player's right. Negative: from the left. */
  crosswindKmh: number;
}

/**
 * Components of the wind relative to the line towards the target.
 * `windFromDeg` is where the wind comes FROM; `headingDeg` is the bearing player -> target.
 * Wind from straight ahead is a full headwind; wind from 90° clockwise of the heading
 * (the player's right) is a full positive crosswind.
 */
export function windComponents(
  speedKmh: number,
  windFromDeg: number,
  headingDeg: number,
): WindComponents {
  const delta = ((windFromDeg - headingDeg) * Math.PI) / 180;
  return {
    headwindKmh: speedKmh * Math.cos(delta),
    crosswindKmh: speedKmh * Math.sin(delta),
  };
}

/** "13:45" in local time; "—" for an invalid date. */
export function formatWindTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

/**
 * "Viento 14 km/h del SO · de frente 11 · cruzado 8 desde la derecha".
 * Without components (no position or no green) only speed and compass direction.
 * The time of the value is added by the UI with `formatWindTime`.
 */
export function formatWindLine(wind: LiveWind, components: WindComponents | null): string {
  if (wind.speedKmh < CALM_WIND_KMH) return 'Viento en calma';

  const from = wind.directionDeg === null ? '' : ` del ${compassDirection(wind.directionDeg)}`;
  const parts = [`Viento ${Math.round(wind.speedKmh)} km/h${from}`];

  if (components) {
    const head = Math.round(components.headwindKmh);
    if (head > 0) parts.push(`de frente ${head}`);
    else if (head < 0) parts.push(`de cola ${-head}`);

    const cross = Math.round(components.crosswindKmh);
    if (cross > 0) parts.push(`cruzado ${cross} desde la derecha`);
    else if (cross < 0) parts.push(`cruzado ${-cross} desde la izquierda`);
  }

  return parts.join(' · ');
}