import {
  isWindowOver,
  summarizeWeather,
  weatherWindow,
  type HourlySample,
  type WeatherWindow,
} from '../domain/weather';
import type { Course, CourseCoordinates, Round, RoundWeather } from '../domain/types';

/** Rounds fetched per run: keeps a bad connection from piling up requests. */
export const MAX_ROUNDS_PER_RUN = 5;

export type BackfillOutcome = 'saved' | 'no_coordinates' | 'window_not_over' | 'unavailable';

export interface BackfillDeps {
  getCourse(courseId: string): Course | undefined;
  fetchSamples(
    coordinates: CourseCoordinates,
    window: WeatherWindow,
    now: string,
  ): Promise<HourlySample[]>;
  saveWeather(weather: RoundWeather): Promise<void>;
  now(): string;
}

/**
 * Fetches and stores the weather of one round. NEVER throws: a weather failure must not
 * block anything (D34). 'unavailable' covers network, service and data problems.
 */
export async function backfillRoundWeather(
  round: Round,
  deps: BackfillDeps,
): Promise<BackfillOutcome> {
  const coordinates = deps.getCourse(round.courseId)?.coordinates;
  if (!coordinates) return 'no_coordinates';

  const window = weatherWindow(round);
  if (!window) return 'unavailable';

  const now = deps.now();
  if (!isWindowOver(window, now)) return 'window_not_over';

  try {
    const samples = await deps.fetchSamples(coordinates, window, now);
    const summary = summarizeWeather(samples, window);
    if (!summary) return 'unavailable';

    await deps.saveWeather({
      roundId: round.id,
      source: 'open-meteo',
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      windowStart: window.start,
      windowEnd: window.end,
      fetchedAt: now,
      ...summary,
    });
    return 'saved';
  } catch {
    return 'unavailable';
  }
}

/**
 * Fills the weather of several rounds, one at a time. Stops at the first failure
 * (probably offline) and after `limit` network attempts. Returns how many were saved.
 */
export async function backfillMissingWeather(
  rounds: readonly Round[],
  deps: BackfillDeps,
  limit: number = MAX_ROUNDS_PER_RUN,
): Promise<number> {
  let saved = 0;
  let attempts = 0;

  for (const round of rounds) {
    if (attempts >= limit) break;
    const outcome = await backfillRoundWeather(round, deps);
    if (outcome === 'saved') {
      saved += 1;
      attempts += 1;
    } else if (outcome === 'unavailable') {
      break;
    }
    // no_coordinates and window_not_over cost no network request.
  }
  return saved;
}