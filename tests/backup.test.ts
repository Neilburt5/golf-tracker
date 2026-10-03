import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { GolfDatabase } from '../src/data/db';
import { createRoundRepository, type RoundRepository } from '../src/data/roundRepository';
import { holeNumbersFor } from '../src/domain/calculations';
import type { Hole, Round, RoundWithHoles } from '../src/domain/types';
import {
  backupFilename,
  createBackup,
  createBackupFile,
  parseBackup,
  restoreBackup,
  serializeBackup,
  type BackupErrorCode,
  type BackupFile,
} from '../src/services/backup';

const EXPORTED_AT = '2026-04-01T12:00:00.000Z';

function makeRoundWithHoles(id: string, date: string, startHole: 1 | 10 = 1): RoundWithHoles {
  const round: Round = {
    id,
    courseId: 'retamares',
    courseName: 'Club de Golf Retamares',
    date,
    tee: 'Amarillas',
    numberOfHoles: 9,
    startHole,
    status: 'finished',
    createdAt: date,
    updatedAt: date,
  };
  const holes: Hole[] = holeNumbersFor(startHole, 9).map((holeNumber, index) => {
    const par = index % 3 === 0 ? 3 : 4;
    const played = index < 3;
    return {
      id: `${id}-hole-${holeNumber}`,
      roundId: id,
      holeNumber,
      par,
      score: played ? par + 1 : null,
      putts: played ? 2 : 0,
      fairway: par === 3 ? null : false,
      gir: false,
      penaltyStrokes: 0,
      bunker: index === 1,
      upAndDown: index === 1 ? true : null,
    };
  });
  return { round, holes };
}

const roundA = makeRoundWithHoles('round-a', '2026-03-01T10:00:00.000Z');
const roundB = makeRoundWithHoles('round-b', '2026-03-08T10:00:00.000Z', 10);
const valid = createBackup([roundA, roundB], EXPORTED_AT);

/** Loose shape used only to corrupt a valid backup on purpose. */
interface Loose extends Record<string, unknown> {
  rounds: Array<{ round: Record<string, unknown>; holes: Array<Record<string, unknown>> }>;
}

function mutated(mutate: (backup: Loose) => void): string {
  const copy = structuredClone(valid) as unknown as Loose;
  mutate(copy);
  return JSON.stringify(copy);
}

function mustParse(text: string): BackupFile {
  const result = parseBackup(text);
  if (!result.ok) throw new Error(`${result.code}: ${result.detail}`);
  return result.backup;
}

describe('creating a backup', () => {
  it('survives a serialise / parse round trip unchanged', () => {
    expect(mustParse(serializeBackup(valid))).toEqual(valid);
  });

  it('names the file after the local date', () => {
    expect(backupFilename(EXPORTED_AT)).toBe('golf-tracker-backup-2026-04-01.json');
  });

  it('builds a JSON file with the backup inside', async () => {
    const { blob, filename } = createBackupFile([roundA, roundB], EXPORTED_AT);

    expect(blob.type).toBe('application/json');
    expect(filename).toBe('golf-tracker-backup-2026-04-01.json');
    expect(mustParse(await blob.text())).toEqual(valid);
  });
});

describe('parseBackup: valid files', () => {
  it('accepts a backup without rounds', () => {
    const empty = JSON.stringify({
      app: 'golf-tracker',
      schemaVersion: 1,
      exportedAt: EXPORTED_AT,
      rounds: [],
    });

    expect(mustParse(empty).rounds).toEqual([]);
  });

  it('ignores unknown fields and sorts holes by number', () => {
    const text = mutated((backup) => {
      backup.extra = 'ignored';
      backup.rounds[0].round.extra = 'ignored';
      backup.rounds[0].holes[0].extra = 'ignored';
      backup.rounds[0].holes.reverse();
    });

    expect(mustParse(text)).toEqual(valid);
  });
});

describe('parseBackup: invalid files', () => {
  it('rejects text that is not JSON', () => {
    const result = parseBackup('this is not json');

    expect(result).toMatchObject({ ok: false, code: 'not_json' });
  });

  it('rejects JSON that is not an object', () => {
    const result = parseBackup('[1, 2, 3]');

    expect(result).toMatchObject({ ok: false, code: 'invalid_structure' });
  });

  const invalidCases: Array<[string, (backup: Loose) => void, BackupErrorCode]> = [
    ['a different app name', (b) => { b.app = 'other-app'; }, 'wrong_app'],
    ['a missing app name', (b) => { delete b.app; }, 'wrong_app'],
    ['a newer schema version', (b) => { b.schemaVersion = 2; }, 'unsupported_version'],
    ['schema version 0', (b) => { b.schemaVersion = 0; }, 'invalid_structure'],
    ['a schema version that is text', (b) => { b.schemaVersion = '1'; }, 'invalid_structure'],
    ['rounds that is not an array', (b) => { Object.assign(b, { rounds: {} }); }, 'invalid_structure'],
    ['an invalid export date', (b) => { b.exportedAt = 'yesterday'; }, 'invalid_structure'],
    ['a round without course name', (b) => { delete b.rounds[0].round.courseName; }, 'invalid_structure'],
    ['12 holes in a round', (b) => { b.rounds[0].round.numberOfHoles = 12; }, 'invalid_structure'],
    ['an unknown round status', (b) => { b.rounds[0].round.status = 'archived'; }, 'invalid_structure'],
    ['an invalid round date', (b) => { b.rounds[0].round.date = 'soon'; }, 'invalid_structure'],
    ['a start hole of 5', (b) => { b.rounds[0].round.startHole = 5; }, 'invalid_structure'],
    ['a hole of another round', (b) => { b.rounds[0].holes[0].roundId = 'other'; }, 'invalid_structure'],
    ['a missing hole', (b) => { b.rounds[0].holes.pop(); }, 'invalid_structure'],
    ['a repeated hole number', (b) => { b.rounds[0].holes[1].holeNumber = 1; }, 'invalid_structure'],
    ['a hole outside the round range', (b) => { b.rounds[0].holes[0].holeNumber = 12; }, 'invalid_structure'],
    ['a score of 0', (b) => { b.rounds[0].holes[0].score = 0; }, 'invalid_structure'],
    ['a fractional score', (b) => { b.rounds[0].holes[0].score = 4.5; }, 'invalid_structure'],
    ['negative putts', (b) => { b.rounds[0].holes[0].putts = -1; }, 'invalid_structure'],
    ['negative penalty strokes', (b) => { b.rounds[0].holes[0].penaltyStrokes = -1; }, 'invalid_structure'],
    ['a fairway that is text', (b) => { b.rounds[0].holes[1].fairway = 'yes'; }, 'invalid_structure'],
    ['an up & down that is text', (b) => { b.rounds[0].holes[1].upAndDown = 'no'; }, 'invalid_structure'],
    ['a missing GIR', (b) => { delete b.rounds[0].holes[0].gir; }, 'invalid_structure'],
    ['a par of 7', (b) => { b.rounds[0].holes[0].par = 7; }, 'invalid_structure'],
    [
      'two rounds with the same id',
      (b) => {
        b.rounds[1].round.id = b.rounds[0].round.id;
        b.rounds[1].holes.forEach((hole) => {
          hole.roundId = b.rounds[0].round.id;
        });
      },
      'invalid_structure',
    ],
    [
      'a hole id used in two rounds',
      (b) => { b.rounds[1].holes[0].id = b.rounds[0].holes[0].id; },
      'invalid_structure',
    ],
  ];

  it.each(invalidCases)('rejects %s', (_name, mutate, code) => {
    const result = parseBackup(mutated(mutate));

    expect(result).toMatchObject({ ok: false, code });
  });

  it('says where the problem is', () => {
    const result = parseBackup(
      mutated((b) => {
        b.rounds[0].holes[2].putts = -1;
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toContain('rounds[0].holes[2].putts');
  });
});

describe('restoreBackup', () => {
  const databases: GolfDatabase[] = [];

  function makeRepository(): RoundRepository {
    const database = new GolfDatabase(`test-${crypto.randomUUID()}`);
    databases.push(database);
    return createRoundRepository(database, () => '2026-05-01T00:00:00.000Z');
  }

  afterEach(async () => {
    for (const database of databases.splice(0)) {
      database.close();
      await database.delete();
    }
  });

  it('imports every round into an empty database', async () => {
    const repository = makeRepository();

    const summary = await restoreBackup(valid, repository);

    expect(summary).toEqual({ imported: 2, skipped: 0, failed: 0 });
    expect(await repository.listRoundsWithHoles()).toHaveLength(2);
  });

  it('skips everything when the same backup is restored twice', async () => {
    const repository = makeRepository();
    await restoreBackup(valid, repository);

    const summary = await restoreBackup(valid, repository);

    expect(summary).toEqual({ imported: 0, skipped: 2, failed: 0 });
    expect(await repository.listRoundsWithHoles()).toHaveLength(2);
  });

  it('never overwrites edits made after the backup was taken', async () => {
    const repository = makeRepository();
    await restoreBackup(valid, repository);
    const [firstHole] = await repository.getHoles(roundA.round.id);
    await repository.saveHole({ ...firstHole, score: 9, putts: 4 });

    await restoreBackup(valid, repository);

    const [afterRestore] = await repository.getHoles(roundA.round.id);
    expect(afterRestore.score).toBe(9);
    expect(afterRestore.putts).toBe(4);
  });

  it('imports only the rounds that are missing', async () => {
    const repository = makeRepository();
    await repository.importRound(roundA);

    const summary = await restoreBackup(valid, repository);

    expect(summary).toEqual({ imported: 1, skipped: 1, failed: 0 });
  });

  it('keeps going when one round fails and counts it', async () => {
    const repository = makeRepository();
    const flaky: Pick<RoundRepository, 'importRound'> = {
      importRound: async (data) => {
        if (data.round.id === 'round-b') throw new Error('disk full');
        return repository.importRound(data);
      },
    };

    const summary = await restoreBackup(valid, flaky);

    expect(summary).toEqual({ imported: 1, skipped: 0, failed: 1 });
    expect(await repository.getRound('round-a')).toBeDefined();
    expect(await repository.getRound('round-b')).toBeUndefined();
  });

  it('moves rounds between two databases through a backup file', async () => {
    const source = makeRepository();
    await source.importRound(roundA);
    await source.importRound(roundB);
    const original = await source.listRoundsWithHoles();

    const text = serializeBackup(createBackup(original, EXPORTED_AT));
    const target = makeRepository();
    const summary = await restoreBackup(mustParse(text), target);

    expect(summary).toEqual({ imported: 2, skipped: 0, failed: 0 });
    expect(await target.listRoundsWithHoles()).toEqual(original);
  });
});