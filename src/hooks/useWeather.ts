import { useEffect, useState } from 'react';
import { getCourseById } from '../data/courseRepository';
import { roundRepository } from '../data/roundRepository';
import type { Round, RoundWeather } from '../domain/types';
import { fetchWeatherSamples } from '../services/weather';
import {
  backfillMissingWeather,
  backfillRoundWeather,
  type BackfillDeps,
  type BackfillOutcome,
} from '../services/weatherBackfill';

const deps: BackfillDeps = {
  getCourse: getCourseById,
  fetchSamples: (coordinates, window, now) => fetchWeatherSamples(coordinates, window, now),
  saveWeather: (weather) => roundRepository.saveWeather(weather),
  now: () => new Date().toISOString(),
};

let backfillRunning = false;

/** Home: fills the weather of past rounds in the background. Silent; never blocks anything. */
export function useWeatherBackfill(): void {
  useEffect(() => {
    if (backfillRunning) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    backfillRunning = true;

    void (async () => {
      try {
        const rounds = await roundRepository.listRoundsMissingWeather();
        await backfillMissingWeather(rounds, deps);
      } catch {
        // Weather is optional: ignore any failure.
      } finally {
        backfillRunning = false;
      }
    })();
  }, []);
}

export type RoundWeatherOutcome = 'loading' | 'existing' | BackfillOutcome;

interface WeatherState {
  roundId: string;
  weather: RoundWeather | null;
  outcome: Exclude<RoundWeatherOutcome, 'loading'>;
}

/** Summary: reads the stored weather of a round and tries to fetch it if missing. */
export function useRoundWeather(round: Round | null): {
  weather: RoundWeather | null;
  outcome: RoundWeatherOutcome;
} {
  const [state, setState] = useState<WeatherState | null>(null);

  useEffect(() => {
    if (!round) return;
    let cancelled = false;

    (async () => {
      try {
        const existing = await roundRepository.getWeather(round.id);
        if (existing) {
          if (!cancelled) setState({ roundId: round.id, weather: existing, outcome: 'existing' });
          return;
        }
        const outcome = await backfillRoundWeather(round, deps);
        const saved = outcome === 'saved' ? await roundRepository.getWeather(round.id) : undefined;
        if (!cancelled) setState({ roundId: round.id, weather: saved ?? null, outcome });
      } catch {
        if (!cancelled) setState({ roundId: round.id, weather: null, outcome: 'unavailable' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [round]);

  const current = round && state && state.roundId === round.id ? state : null;
  return {
    weather: current ? current.weather : null,
    outcome: current ? current.outcome : 'loading',
  };
}