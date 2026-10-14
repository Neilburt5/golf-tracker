import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { GolfDatabase } from '../src/data/db';
import { createRoundRepository, type RoundRepository } from '../src/data/roundRepository';
import type { Course, ShotInput } from '../src/domain/types';

const course: Course = {
  id: 'c1',
  name: 'Campo',
  location: 'Madrid',
  numberOfHoles: 18,
  tees: ['Blancas'],
  holes: Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4 })),
};

function input(id: string, club: ShotInput['club'], withFix = true): ShotInput {
  return {
    id,
    club,
    fix: withFix
      ? {
          latitude: 40.6,
          longitude: -3.47,
          accuracy: 4,
          fixedAt: '2026-10-14T09:00:00.000Z',
          fresh: true,
        }
      : null,
    createdAt: '2026-10-14T09:00:00.000Z',
  };
}

let counter = 0;
let clock = '2026-10-14T08:30:00.000Z';
let db: GolfDatabase;
let repo: RoundRepository;

beforeEach(() => {
  counter += 1;
  clock = '2026-10-14T08:30:00.000Z';
  db = new GolfDatabase(`shots-test-${counter}`);
  repo = createRoundRepository(db, () => clock);
});

async function newRound() {
  return repo.createRound({ course, tee: 'Blancas', numberOfHoles: 18, startHole: 1 });
}

describe('saving the shots of a hole', () => {
  it('stores the shots with sequence 1..n from the array order', async () => {
    const round = await newRound();
    const saved = await repo.saveHoleShots(round.id, 3, [
      input('a', 'driver'),
      input('b', 'iron7'),
      input('c', 'putter'),
    ]);

    expect(saved.map((s) => [s.id, s.sequence, s.holeNumber, s.roundId])).toEqual([
      ['a', 1, 3, round.id],
      ['b', 2, 3, round.id],
      ['c', 3, 3, round.id],
    ]);
    expect((await repo.getHoleShots(round.id, 3)).map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(await repo.getHoleShots(round.id, 4)).toEqual([]);
  });

  it('replaces all the shots of the hole, so deleting or reordering never collides', async () => {
    const round = await newRound();
    await repo.saveHoleShots(round.id, 1, [input('a', 'driver'), input('b', 'iron7'), input('c', 'pw')]);
    await repo.saveHoleShots(round.id, 1, [input('c', 'pw'), input('a', 'driver')]);

    const shots = await repo.getHoleShots(round.id, 1);
    expect(shots.map((s) => [s.id, s.sequence])).toEqual([
      ['c', 1],
      ['a', 2],
    ]);
  });

  it('does not touch the shots of other holes or rounds', async () => {
    const one = await newRound();
    const two = await newRound();
    await repo.saveHoleShots(one.id, 1, [input('a', 'driver')]);
    await repo.saveHoleShots(one.id, 2, [input('b', 'driver')]);
    await repo.saveHoleShots(two.id, 1, [input('c', 'driver')]);

    await repo.saveHoleShots(one.id, 1, []);

    expect(await repo.getHoleShots(one.id, 1)).toEqual([]);
    expect((await repo.getRoundShots(one.id)).map((s) => s.id)).toEqual(['b']);
    expect((await repo.getRoundShots(two.id)).map((s) => s.id)).toEqual(['c']);
  });

  it('keeps a shot without a fix (no GPS) and bumps round.updatedAt', async () => {
    const round = await newRound();
    clock = '2026-10-14T09:15:00.000Z';
    await repo.saveHoleShots(round.id, 1, [input('a', 'driver', false)]);

    expect((await repo.getHoleShots(round.id, 1))[0].fix).toBeNull();
    expect((await repo.getRound(round.id))!.updatedAt).toBe(clock);
  });

  it('never looks at the score: shots that do not match it are saved (D37)', async () => {
    const round = await newRound();
    const [hole] = await repo.getHoles(round.id);
    await repo.saveHole({ ...hole, score: 3, putts: 2 });
    await expect(
      repo.saveHoleShots(round.id, 1, [input('a', 'driver'), input('b', 'iron7'), input('c', 'iron9')]),
    ).resolves.toHaveLength(3);
  });

  it('rejects, writing nothing, an unknown round or hole, an invalid shot or a repeated id', async () => {
    const round = await newRound();
    await repo.saveHoleShots(round.id, 1, [input('keep', 'driver')]);

    await expect(repo.saveHoleShots('nope', 1, [input('a', 'driver')])).rejects.toThrow();
    await expect(repo.saveHoleShots(round.id, 19, [input('a', 'driver')])).rejects.toThrow();
    await expect(
      repo.saveHoleShots(round.id, 1, [{ ...input('a', 'driver'), club: 'wood5' as never }]),
    ).rejects.toThrow();
    await expect(
      repo.saveHoleShots(round.id, 1, [input('a', 'driver'), input('a', 'iron7')]),
    ).rejects.toThrow();

    expect((await repo.getHoleShots(round.id, 1)).map((s) => s.id)).toEqual(['keep']);
  });

  it('rejects a hole outside a 9-hole back-nine round', async () => {
    const round = await repo.createRound({ course, tee: 'Blancas', numberOfHoles: 9, startHole: 10 });
    await expect(repo.saveHoleShots(round.id, 3, [input('a', 'driver')])).rejects.toThrow();
    await expect(repo.saveHoleShots(round.id, 12, [input('a', 'driver')])).resolves.toHaveLength(1);
  });
});

describe('listing, deleting and importing rounds with shots', () => {
  it('includes shots in listRoundsWithHoles only when they exist, ordered by hole and sequence', async () => {
    const withShots = await newRound();
    const without = await newRound();
    await repo.saveHoleShots(withShots.id, 2, [input('c', 'driver')]);
    await repo.saveHoleShots(withShots.id, 1, [input('a', 'driver'), input('b', 'iron7')]);

    const list = await repo.listRoundsWithHoles();
    const a = list.find((x) => x.round.id === withShots.id)!;
    const b = list.find((x) => x.round.id === without.id)!;
    expect(a.shots!.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(b.shots).toBeUndefined();
  });

  it('deletes the shots together with the round, and only those', async () => {
    const one = await newRound();
    const two = await newRound();
    await repo.saveHoleShots(one.id, 1, [input('a', 'driver')]);
    await repo.saveHoleShots(two.id, 1, [input('b', 'driver')]);

    await repo.deleteRound(one.id);
    expect(await db.shots.count()).toBe(1);
    expect((await repo.getRoundShots(two.id)).map((s) => s.id)).toEqual(['b']);
  });

  it('imports shots together with the round', async () => {
    const source = await newRound();
    await repo.saveHoleShots(source.id, 1, [input('a', 'driver'), input('b', 'putter')]);
    const data = (await repo.listRoundsWithHoles())[0];

    const target = createRoundRepository(new GolfDatabase(`shots-test-target-${counter}`));
    expect(await target.importRound(data)).toBe('imported');
    expect((await target.getRoundShots(source.id)).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('never overwrites: an existing round keeps its shots and gets none from the file', async () => {
    const round = await newRound();
    await repo.saveHoleShots(round.id, 1, [input('mine', 'driver')]);
    const holes = await repo.getHoles(round.id);

    const result = await repo.importRound({
      round,
      holes,
      shots: [{ ...input('theirs', 'iron7'), roundId: round.id, holeNumber: 1, sequence: 1 }],
    });
    expect(result).toBe('skipped');
    expect((await repo.getRoundShots(round.id)).map((s) => s.id)).toEqual(['mine']);
  });

  it('rejects shots that belong to another round, leaving nothing behind', async () => {
    const round = await newRound();
    const holes = await repo.getHoles(round.id);
    const other = createRoundRepository(new GolfDatabase(`shots-test-other-${counter}`));
    await expect(
      other.importRound({
        round,
        holes,
        shots: [{ ...input('a', 'driver'), roundId: 'another', holeNumber: 1, sequence: 1 }],
      }),
    ).rejects.toThrow();
    expect(await other.getRound(round.id)).toBeUndefined();
  });
});

describe('schema migration v2 to v3', () => {
  it('keeps rounds and weather and adds empty shots and settings tables', async () => {
    const name = `shots-migration-${counter}`;
    const old = new Dexie(name);
    old.version(1).stores({
      rounds: 'id, status, date, updatedAt',
      holes: 'id, roundId, &[roundId+holeNumber]',
    });
    old.version(2).stores({ weather: 'roundId' });
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
    await old.table('weather').add({ roundId: 'r1', temperatureC: 18 });
    old.close();

    const upgraded = new GolfDatabase(name);
    expect(await upgraded.rounds.get('r1')).toBeDefined();
    expect(await upgraded.weather.count()).toBe(1);
    expect(await upgraded.shots.count()).toBe(0);
    expect(await upgraded.settings.count()).toBe(0);
  });
});