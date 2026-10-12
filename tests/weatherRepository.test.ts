import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { GolfDatabase } from '../src/data/db';
import { createRoundRepository, type RoundRepository } from '../src/data/roundRepository';
import type { Course, RoundWeather } from '../src/domain/types';

const course: Course = {
  id: 'c1',
  name: 'Campo',
  location: 'Madrid',
  numberOfHoles: 18,
  tees: ['Blancas'],
  holes: Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4 })),
};

function weatherFor(roundId: string): RoundWeather {
  return {
    roundId,
    source: 'open-meteo',
    latitude: 40.5,
    longitude: -3.5,
    windowStart: '2026-10-01T08:00:00.000Z',
    windowEnd: '2026-10-01T13:00:00.000Z',
    hours: 5,
    fetchedAt: '2026-10-02T00:00:00.000Z',
    temperatureC: 18.5,
    precipitationMm: 0,
    pressureHpa: 940,
    windSpeedKmh: 12,
    windDirectionDeg: 225,
    windGustKmh: 25,
  };
}

let counter = 0;
let clock = '2026-10-01T08:30:00.000Z';
let db: GolfDatabase;
let repo: RoundRepository;

beforeEach(() => {
  counter += 1;
  clock = '2026-10-01T08:30:00.000Z';
  db = new GolfDatabase(`weather-test-${counter}`);
  repo = createRoundRepository(db, () => clock);
});

async function newRound() {
  return repo.createRound({ course, tee: 'Blancas', numberOfHoles: 18, startHole: 1 });
}

describe('weather storage', () => {
  it('saves and reads the weather without touching round.updatedAt', async () => {
    const round = await newRound();
    clock = '2026-10-02T09:00:00.000Z';
    await repo.saveWeather(weatherFor(round.id));

    expect(await repo.getWeather(round.id)).toEqual(weatherFor(round.id));
    expect((await repo.getRound(round.id))!.updatedAt).toBe(round.updatedAt);
  });

  it('rejects weather for an unknown round', async () => {
    await expect(repo.saveWeather(weatherFor('nope'))).rejects.toThrow();
  });

  it('lists rounds without weather', async () => {
    const withWeather = await newRound();
    const without = await newRound();
    await repo.saveWeather(weatherFor(withWeather.id));

    const missing = await repo.listRoundsMissingWeather();
    expect(missing.map((r) => r.id)).toEqual([without.id]);
  });

  it('includes weather in listRoundsWithHoles only when it exists', async () => {
    const withWeather = await newRound();
    const without = await newRound();
    await repo.saveWeather(weatherFor(withWeather.id));

    const list = await repo.listRoundsWithHoles();
    const a = list.find((x) => x.round.id === withWeather.id)!;
    const b = list.find((x) => x.round.id === without.id)!;
    expect(a.weather).toEqual(weatherFor(withWeather.id));
    expect(b.weather).toBeUndefined();
  });

  it('deletes the weather together with the round', async () => {
    const round = await newRound();
    await repo.saveWeather(weatherFor(round.id));
    await repo.deleteRound(round.id);
    expect(await db.weather.count()).toBe(0);
  });
});

describe('importing rounds with weather', () => {
  it('imports weather together with the round', async () => {
    const source = await newRound();
    const holes = await repo.getHoles(source.id);

    const targetDb = new GolfDatabase(`weather-test-target-${counter}`);
    const target = createRoundRepository(targetDb, () => clock);
    const result = await target.importRound({
      round: source,
      holes,
      weather: weatherFor(source.id),
    });

    expect(result).toBe('imported');
    expect(await target.getWeather(source.id)).toEqual(weatherFor(source.id));
  });

  it('never overwrites: an existing round keeps its data and gets no imported weather', async () => {
    const round = await newRound();
    const holes = await repo.getHoles(round.id);

    const result = await repo.importRound({ round, holes, weather: weatherFor(round.id) });
    expect(result).toBe('skipped');
    expect(await repo.getWeather(round.id)).toBeUndefined();
  });

  it('rejects weather that belongs to another round', async () => {
    const round = await newRound();
    const holes = await repo.getHoles(round.id);
    const other = createRoundRepository(new GolfDatabase(`weather-test-other-${counter}`));
    await expect(
      other.importRound({ round, holes, weather: weatherFor('another-round') }),
    ).rejects.toThrow();
  });
});

describe('schema migration v1 to v2', () => {
  it('keeps existing rounds and adds an empty weather table', async () => {
    const name = `weather-migration-${counter}`;
    const old = new Dexie(name);
    old.version(1).stores({
      rounds: 'id, status, date, updatedAt',
      holes: 'id, roundId, &[roundId+holeNumber]',
    });
    await old.table('rounds').add({
      id: 'r1',
      courseId: 'c1',
      courseName: 'Campo',
      date: '2026-10-01T08:30:00.000Z',
      tee: 'Blancas',
      numberOfHoles: 18,
      startHole: 1,
      status: 'finished',
      createdAt: '2026-10-01T08:30:00.000Z',
      updatedAt: '2026-10-01T13:00:00.000Z',
    });
    old.close();

    const upgraded = new GolfDatabase(name);
    expect(await upgraded.rounds.get('r1')).toBeDefined();
    expect(await upgraded.weather.count()).toBe(0);
  });
});