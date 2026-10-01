import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GolfDatabase } from '../src/data/db';
import { createRoundRepository, type RoundRepository } from '../src/data/roundRepository';
import type { Course } from '../src/domain/types';

function makeCourse(numberOfHoles: 9 | 18 = 18): Course {
  const pars = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 4, 5];
  return {
    id: 'test-course',
    name: 'Test Course',
    location: 'Nowhere',
    numberOfHoles,
    tees: ['White', 'Yellow'],
    holes: pars.slice(0, numberOfHoles).map((par, i) => ({ number: i + 1, par })),
  };
}

let testDb: GolfDatabase;
let repo: RoundRepository;
let tick: number;

beforeEach(() => {
  testDb = new GolfDatabase(`golf-test-${crypto.randomUUID()}`);
  tick = 0;
  // Deterministic, strictly increasing clock
  repo = createRoundRepository(testDb, () => new Date(Date.UTC(2026, 0, 1, 10, 0, tick++)).toISOString());
});

afterEach(async () => {
  await testDb.delete();
});

describe('createRound', () => {
  it('creates an in-progress round with one unplayed hole row per hole', async () => {
    const round = await repo.createRound({
      course: makeCourse(),
      tee: 'White',
      numberOfHoles: 18,
      startHole: 1,
    });

    expect(round.status).toBe('in_progress');
    expect(round.courseName).toBe('Test Course');

    const holes = await repo.getHoles(round.id);
    expect(holes).toHaveLength(18);
    expect(holes.map((h) => h.holeNumber)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(holes.every((h) => h.score === null)).toBe(true);
    expect(holes[0].par).toBe(4);
  });

  it('uses real hole numbers 10-18 for a back nine', async () => {
    const round = await repo.createRound({
      course: makeCourse(),
      tee: 'White',
      numberOfHoles: 9,
      startHole: 10,
    });
    const holes = await repo.getHoles(round.id);
    expect(holes.map((h) => h.holeNumber)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(holes[1].par).toBe(3);
  });

  it('sets fairway to null on par 3 and false otherwise', async () => {
    const round = await repo.createRound({
      course: makeCourse(),
      tee: 'White',
      numberOfHoles: 9,
      startHole: 1,
    });
    const holes = await repo.getHoles(round.id);
    expect(holes[2].par).toBe(3);
    expect(holes[2].fairway).toBeNull();
    expect(holes[0].fairway).toBe(false);
  });

  it('rejects a back nine on a 9-hole course and writes nothing', async () => {
    await expect(
      repo.createRound({ course: makeCourse(9), tee: 'White', numberOfHoles: 9, startHole: 10 }),
    ).rejects.toThrow(/no hole 10/);
    expect(await testDb.rounds.count()).toBe(0);
    expect(await testDb.holes.count()).toBe(0);
  });

  it('rejects an unknown tee', async () => {
    await expect(
      repo.createRound({ course: makeCourse(), tee: 'Purple', numberOfHoles: 18, startHole: 1 }),
    ).rejects.toThrow(/Unknown tee/);
  });

  it('snapshots the course: later edits to the course object do not change the round', async () => {
    const course = makeCourse();
    const round = await repo.createRound({ course, tee: 'White', numberOfHoles: 18, startHole: 1 });

    course.name = 'Renamed';
    course.holes[0].par = 5;

    expect((await repo.getRound(round.id))?.courseName).toBe('Test Course');
    expect((await repo.getHoles(round.id))[0].par).toBe(4);
  });
});

describe('saveHole', () => {
  it('persists a hole and restores it, including edits to previous holes', async () => {
    const round = await repo.createRound({
      course: makeCourse(),
      tee: 'White',
      numberOfHoles: 18,
      startHole: 1,
    });
    const holes = await repo.getHoles(round.id);

    await repo.saveHole({ ...holes[0], score: 5, putts: 2, gir: true, bunker: true });
    await repo.saveHole({ ...holes[1], score: 4, putts: 1 });

    // Go back and edit hole 1
    const reloaded = await repo.getHoles(round.id);
    expect(reloaded[0]).toMatchObject({ score: 5, putts: 2, gir: true, bunker: true });
    await repo.saveHole({ ...reloaded[0], score: 6, putts: 3 });

    const final = await repo.getHoles(round.id);
    expect(final[0]).toMatchObject({ score: 6, putts: 3, gir: true, bunker: true });
    expect(final[1]).toMatchObject({ score: 4, putts: 1 });
    expect(final[2].score).toBeNull();
  });

  it('keeps null values (not applicable) intact', async () => {
    const round = await repo.createRound({
      course: makeCourse(),
      tee: 'White',
      numberOfHoles: 9,
      startHole: 1,
    });
    const [h1] = await repo.getHoles(round.id);
    await repo.saveHole({ ...h1, score: 4, fairway: true, upAndDown: null });
    const [saved] = await repo.getHoles(round.id);
    expect(saved.fairway).toBe(true);
    expect(saved.upAndDown).toBeNull();
  });

  it('updates the round updatedAt', async () => {
    const round = await repo.createRound({
      course: makeCourse(),
      tee: 'White',
      numberOfHoles: 9,
      startHole: 1,
    });
    const [h1] = await repo.getHoles(round.id);
    await repo.saveHole({ ...h1, score: 4 });
    const updated = await repo.getRound(round.id);
    expect(updated!.updatedAt > round.updatedAt).toBe(true);
  });

  it('rejects a hole that does not exist', async () => {
    const round = await repo.createRound({
      course: makeCourse(),
      tee: 'White',
      numberOfHoles: 9,
      startHole: 1,
    });
    const [h1] = await repo.getHoles(round.id);
    await expect(repo.saveHole({ ...h1, id: 'nope', score: 4 })).rejects.toThrow(/does not exist/);
  });
});

describe('in-progress round', () => {
  it('returns undefined when there is no round', async () => {
    expect(await repo.getInProgressRound()).toBeUndefined();
  });

  it('restores the in-progress round and stops returning it once finished', async () => {
    const round = await repo.createRound({
      course: makeCourse(),
      tee: 'White',
      numberOfHoles: 18,
      startHole: 1,
    });
    expect((await repo.getInProgressRound())?.id).toBe(round.id);

    const finished = await repo.finishRound(round.id);
    expect(finished.status).toBe('finished');
    expect(await repo.getInProgressRound()).toBeUndefined();
    expect((await repo.getRound(round.id))?.status).toBe('finished');
  });

  it('returns the most recently updated round if several are in progress', async () => {
    const first = await repo.createRound({
      course: makeCourse(),
      tee: 'White',
      numberOfHoles: 9,
      startHole: 1,
    });
    const second = await repo.createRound({
      course: makeCourse(),
      tee: 'White',
      numberOfHoles: 9,
      startHole: 1,
    });
    expect((await repo.getInProgressRound())?.id).toBe(second.id);

    const [h1] = await repo.getHoles(first.id);
    await repo.saveHole({ ...h1, score: 4 });
    expect((await repo.getInProgressRound())?.id).toBe(first.id);
  });

  it('finishRound is idempotent and rejects unknown rounds', async () => {
    const round = await repo.createRound({
      course: makeCourse(),
      tee: 'White',
      numberOfHoles: 9,
      startHole: 1,
    });
    const a = await repo.finishRound(round.id);
    const b = await repo.finishRound(round.id);
    expect(b.updatedAt).toBe(a.updatedAt);
    await expect(repo.finishRound('missing')).rejects.toThrow(/does not exist/);
  });
});

describe('schema', () => {
  it('enforces a unique [roundId+holeNumber]', async () => {
    const round = await repo.createRound({
      course: makeCourse(),
      tee: 'White',
      numberOfHoles: 9,
      startHole: 1,
    });
    const [h1] = await repo.getHoles(round.id);
    await expect(testDb.holes.add({ ...h1, id: crypto.randomUUID() })).rejects.toThrow();
  });
});