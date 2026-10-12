import { describe, expect, it, vi } from 'vitest';
import type { HourlySample } from '../src/domain/weather';
import type { Course, Round } from '../src/domain/types';
import {
  backfillMissingWeather,
  backfillRoundWeather,
  type BackfillDeps,
} from '../src/services/weatherBackfill';

const course: Course = {
  id: 'c1',
  name: 'Campo',
  location: 'Madrid',
  numberOfHoles: 18,
  tees: ['Blancas'],
  holes: Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4 })),
  coordinates: { latitude: 40.5, longitude: -3.5 },
};

function makeRound(id = 'r1'): Round {
  return {
    id,
    courseId: 'c1',
    courseName: 'Campo',
    date: '2026-10-01T08:30:00.000Z',
    tee: 'Blancas',
    numberOfHoles: 18,
    startHole: 1,
    status: 'finished',
    createdAt: '2026-10-01T08:30:00.000Z',
    updatedAt: '2026-10-01T13:00:00.000Z',
  };
}

const slots: HourlySample[] = [9, 10, 11, 12, 13].map((hour) => ({
  time: Date.parse(`2026-10-01T${String(hour).padStart(2, '0')}:00:00.000Z`),
  temperatureC: 20,
  precipitationMm: 0,
  pressureHpa: 940,
  windSpeedKmh: 10,
  windDirectionDeg: 90,
  windGustKmh: 15,
}));

function makeDeps(overrides: Partial<BackfillDeps> = {}): BackfillDeps {
  return {
    getCourse: () => course,
    fetchSamples: vi.fn(async () => slots),
    saveWeather: vi.fn(async () => undefined),
    now: () => '2026-10-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('backfillRoundWeather', () => {
  it('fetches, summarizes and saves the weather', async () => {
    const deps = makeDeps();
    expect(await backfillRoundWeather(makeRound(), deps)).toBe('saved');
    expect(deps.saveWeather).toHaveBeenCalledWith(
      expect.objectContaining({
        roundId: 'r1',
        source: 'open-meteo',
        latitude: 40.5,
        longitude: -3.5,
        windowStart: '2026-10-01T08:00:00.000Z',
        windowEnd: '2026-10-01T13:00:00.000Z',
        hours: 5,
        temperatureC: 20,
      }),
    );
  });

  it('does nothing when the course has no coordinates or is unknown', async () => {
    const noCoordinates = makeDeps({ getCourse: () => ({ ...course, coordinates: undefined }) });
    expect(await backfillRoundWeather(makeRound(), noCoordinates)).toBe('no_coordinates');
    expect(noCoordinates.fetchSamples).not.toHaveBeenCalled();

    const unknown = makeDeps({ getCourse: () => undefined });
    expect(await backfillRoundWeather(makeRound(), unknown)).toBe('no_coordinates');
  });

  it('waits until the round window is over', async () => {
    const deps = makeDeps({ now: () => '2026-10-01T12:00:00.000Z' });
    expect(await backfillRoundWeather(makeRound(), deps)).toBe('window_not_over');
    expect(deps.fetchSamples).not.toHaveBeenCalled();
  });

  it('never throws: network, data and storage failures are "unavailable"', async () => {
    const network = makeDeps({
      fetchSamples: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    expect(await backfillRoundWeather(makeRound(), network)).toBe('unavailable');

    const noData = makeDeps({ fetchSamples: vi.fn(async () => []) });
    expect(await backfillRoundWeather(makeRound(), noData)).toBe('unavailable');
    expect(noData.saveWeather).not.toHaveBeenCalled();

    const storage = makeDeps({
      saveWeather: vi.fn(async () => {
        throw new Error('quota');
      }),
    });
    expect(await backfillRoundWeather(makeRound(), storage)).toBe('unavailable');
  });
});

describe('backfillMissingWeather', () => {
  it('respects the per-run limit', async () => {
    const deps = makeDeps();
    const rounds = [makeRound('a'), makeRound('b'), makeRound('c')];
    expect(await backfillMissingWeather(rounds, deps, 2)).toBe(2);
    expect(deps.fetchSamples).toHaveBeenCalledTimes(2);
  });

  it('stops at the first failure (probably offline)', async () => {
    const deps = makeDeps({
      fetchSamples: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    expect(await backfillMissingWeather([makeRound('a'), makeRound('b')], deps)).toBe(0);
    expect(deps.fetchSamples).toHaveBeenCalledTimes(1);
  });
});