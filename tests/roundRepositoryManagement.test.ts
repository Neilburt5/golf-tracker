import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GolfDatabase } from '../src/data/db';
import { createRoundRepository, type RoundRepository } from '../src/data/roundRepository';
import type { Course } from '../src/domain/types';

const course: Course = {
  id: 'test-course',
  name: 'Test Course',
  location: 'Nowhere',
  numberOfHoles: 18,
  tees: ['Amarillas', 'Rojas'],
  holes: Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: i % 3 === 0 ? 3 : 4 })),
};

let database: GolfDatabase;
let repo: RoundRepository;

beforeEach(() => {
  database = new GolfDatabase(`test-${crypto.randomUUID()}`);
  repo = createRoundRepository(database, () => '2026-01-01T00:00:00.000Z');
});

afterEach(async () => {
  database.close();
  await database.delete();
});

async function newRound(date: string, startHole: 1 | 10 = 1, numberOfHoles: 9 | 18 = 18) {
  return repo.createRound({ course, tee: 'Amarillas', numberOfHoles, startHole, date });
}

describe('listRoundsWithHoles', () => {
  it('returns an empty list when there are no rounds', async () => {
    expect(await repo.listRoundsWithHoles()).toEqual([]);
  });

  it('orders rounds newest first and holes by hole number', async () => {
    const older = await newRound('2026-03-01T10:00:00.000Z');
    const newer = await newRound('2026-04-01T10:00:00.000Z', 10, 9);

    const list = await repo.listRoundsWithHoles();

    expect(list.map((r) => r.round.id)).toEqual([newer.id, older.id]);
    expect(list[0].holes.map((h) => h.holeNumber)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(list[1].holes).toHaveLength(18);
    expect(list[1].holes[0].holeNumber).toBe(1);
  });

  it('keeps the holes of each round separate', async () => {
    const a = await newRound('2026-03-01T10:00:00.000Z');
    await newRound('2026-04-01T10:00:00.000Z');

    const list = await repo.listRoundsWithHoles();
    const listed = list.find((r) => r.round.id === a.id);

    expect(listed?.holes.every((h) => h.roundId === a.id)).toBe(true);
  });
});

describe('deleteRound', () => {
  it('removes the round and all of its holes', async () => {
    const round = await newRound('2026-03-01T10:00:00.000Z');

    await repo.deleteRound(round.id);

    expect(await repo.getRound(round.id)).toBeUndefined();
    expect(await repo.getHoles(round.id)).toEqual([]);
  });

  it('does not touch other rounds', async () => {
    const doomed = await newRound('2026-03-01T10:00:00.000Z');
    const kept = await newRound('2026-04-01T10:00:00.000Z');

    await repo.deleteRound(doomed.id);

    expect(await repo.getRound(kept.id)).toBeDefined();
    expect(await repo.getHoles(kept.id)).toHaveLength(18);
  });

  it('does nothing for an unknown id', async () => {
    const round = await newRound('2026-03-01T10:00:00.000Z');

    await expect(repo.deleteRound('does-not-exist')).resolves.toBeUndefined();

    expect(await repo.getRound(round.id)).toBeDefined();
  });
});

describe('importRound', () => {
  it('imports a round and its holes into an empty database', async () => {
    const source = await newRound('2026-03-01T10:00:00.000Z');
    const data = { round: source, holes: await repo.getHoles(source.id) };
    await repo.deleteRound(source.id);

    const result = await repo.importRound(data);

    expect(result).toBe('imported');
    expect(await repo.getRound(source.id)).toEqual(source);
    expect(await repo.getHoles(source.id)).toEqual(data.holes);
  });

  it('skips a round that already exists and never overwrites it', async () => {
    const source = await newRound('2026-03-01T10:00:00.000Z');
    const originalHoles = await repo.getHoles(source.id);
    const backupCopy = { round: source, holes: originalHoles };

    // The user keeps playing after the backup was made.
    await repo.saveHole({ ...originalHoles[0], score: 5, putts: 2 });

    const result = await repo.importRound(backupCopy);

    expect(result).toBe('skipped');
    const holes = await repo.getHoles(source.id);
    expect(holes[0].score).toBe(5);
    expect(holes[0].putts).toBe(2);
  });

  it('rejects holes that belong to another round and writes nothing', async () => {
    const source = await newRound('2026-03-01T10:00:00.000Z');
    const holes = await repo.getHoles(source.id);
    await repo.deleteRound(source.id);

    const tampered = {
      round: source,
      holes: holes.map((h, i) => (i === 0 ? { ...h, roundId: 'someone-else' } : h)),
    };

    await expect(repo.importRound(tampered)).rejects.toThrow();
    expect(await repo.getRound(source.id)).toBeUndefined();
    expect(await repo.listRoundsWithHoles()).toEqual([]);
  });

  it('rolls back the round if the holes cannot be written', async () => {
    const a = await newRound('2026-03-01T10:00:00.000Z');
    const aHoles = await repo.getHoles(a.id);

    // A new round whose first hole reuses an existing hole id: bulkAdd must fail.
    const b = { ...a, id: crypto.randomUUID() };
    const clashing = aHoles.map((h) => ({ ...h, roundId: b.id }));

    await expect(repo.importRound({ round: b, holes: clashing })).rejects.toThrow();
    expect(await repo.getRound(b.id)).toBeUndefined();
  });
});