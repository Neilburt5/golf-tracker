import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { GolfDatabase } from '../src/data/db';
import { createRoundRepository } from '../src/data/roundRepository';
import { createSettingsRepository } from '../src/data/settingsRepository';
import type { Hole, RoundWithHoles, Shot } from '../src/domain/types';
import {
  BACKUP_SCHEMA_VERSION,
  createBackup,
  createBackupFile,
  parseBackup,
  restoreBackup,
  serializeBackup,
} from '../src/services/backup';

const exportedAt = '2026-10-14T10:00:00.000Z';

function makeShots(): Shot[] {
  const fix = {
    latitude: 40.6,
    longitude: -3.47,
    accuracy: 4,
    fixedAt: '2026-10-14T09:00:00.000Z',
    fresh: true,
  };
  return [
    { id: 's1', roundId: 'r1', holeNumber: 1, sequence: 1, club: 'driver', fix, createdAt: exportedAt },
    { id: 's2', roundId: 'r1', holeNumber: 1, sequence: 2, club: 'iron7', fix: null, createdAt: exportedAt },
    { id: 's3', roundId: 'r1', holeNumber: 2, sequence: 1, club: 'putter', fix, createdAt: exportedAt },
  ];
}

function makeData(withShots: boolean): RoundWithHoles {
  const holes: Hole[] = Array.from({ length: 9 }, (_, i) => ({
    id: `h${i + 1}`,
    roundId: 'r1',
    holeNumber: i + 1,
    par: 4,
    score: 5,
    putts: 2,
    fairway: true,
    gir: false,
    penaltyStrokes: 0,
    bunker: false,
    upAndDown: null,
  }));
  const data: RoundWithHoles = {
    round: {
      id: 'r1',
      courseId: 'c1',
      courseName: 'Campo',
      date: '2026-10-14T08:30:00.000Z',
      tee: 'Blancas',
      numberOfHoles: 9,
      startHole: 1,
      status: 'finished',
      createdAt: '2026-10-14T08:30:00.000Z',
      updatedAt: '2026-10-14T11:00:00.000Z',
    },
    holes,
  };
  return withShots ? { ...data, shots: makeShots() } : data;
}

/** The parts of a backup file that the tests below tamper with. */
interface ShotJson {
  id: unknown;
  roundId: unknown;
  holeNumber: unknown;
  sequence: unknown;
  club: unknown;
  createdAt: unknown;
  extra?: unknown;
  fix: Record<string, unknown>;
}

interface BackupJson {
  schemaVersion: number;
  clubBag?: unknown;
  rounds: Array<{ shots: ShotJson[] }>;
}

/** Parses a backup, applies `mutate` to the plain JSON, and returns the parse result. */
function parseMutated(mutate: (file: BackupJson) => void) {
  const file = JSON.parse(serializeBackup(createBackup([makeData(true)], exportedAt, ['driver', 'pw'])));
  mutate(file);
  return parseBackup(JSON.stringify(file));
}

describe('backup with shots and club bag (schemaVersion 3)', () => {
  it('writes schemaVersion 3', () => {
    expect(BACKUP_SCHEMA_VERSION).toBe(3);
    expect(createBackup([], exportedAt).schemaVersion).toBe(3);
  });

  it('round-trips shots and the club bag', () => {
    const text = serializeBackup(createBackup([makeData(true)], exportedAt, ['pw', 'driver']));
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.backup.rounds[0].shots).toEqual(makeShots());
      expect(parsed.backup.clubBag).toEqual(['driver', 'pw', 'putter']);
    }
  });

  it('omits clubBag and shots when there are none', () => {
    const file = JSON.parse(serializeBackup(createBackup([makeData(false)], exportedAt)));
    expect('clubBag' in file).toBe(false);
    expect('shots' in file.rounds[0]).toBe(false);
  });

  it('createBackupFile accepts the bag as an optional third argument', async () => {
    const { blob } = createBackupFile([makeData(true)], exportedAt, ['driver']);
    expect(JSON.parse(await blob.text()).clubBag).toEqual(['driver']);
    const plain = createBackupFile([makeData(false)], exportedAt);
    expect('clubBag' in JSON.parse(await plain.blob.text())).toBe(false);
  });

  it('still accepts schemaVersion 1 and 2 files, which have no shots or bag', () => {
    for (const version of [1, 2]) {
      const file = JSON.parse(serializeBackup(createBackup([makeData(false)], exportedAt)));
      file.schemaVersion = version;
      const parsed = parseBackup(JSON.stringify(file));
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.backup.rounds[0].shots).toBeUndefined();
        expect(parsed.backup.clubBag).toBeUndefined();
      }
    }
  });

  it('rejects a newer schema version', () => {
    const parsed = parseMutated((file) => {
      file.schemaVersion = 4;
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.code).toBe('unsupported_version');
  });

  it('treats an empty shots list as no shots', () => {
    const parsed = parseMutated((file) => {
      file.rounds[0].shots = [];
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.backup.rounds[0].shots).toBeUndefined();
  });

  it('drops unknown fields from shots and fixes', () => {
    const parsed = parseMutated((file) => {
      file.rounds[0].shots[0].extra = 'x';
      file.rounds[0].shots[0].fix.extra = 'y';
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.backup.rounds[0].shots![0]).toEqual(makeShots()[0]);
  });

  it('rejects invalid shots', () => {
    const cases: Array<(file: BackupJson) => void> = [
      (f) => { f.rounds[0].shots[0].roundId = 'other'; },
      (f) => { f.rounds[0].shots[0].holeNumber = 12; }, // outside holes 1-9
      (f) => { f.rounds[0].shots[0].sequence = 0; },
      (f) => { f.rounds[0].shots[0].club = 'wood5'; },
      (f) => { f.rounds[0].shots[0].fix.latitude = 100; },
      (f) => { f.rounds[0].shots[0].fix.accuracy = -2; },
      (f) => { f.rounds[0].shots[0].fix.fresh = 'yes'; },
      (f) => { f.rounds[0].shots[0].createdAt = 'nope'; },
      (f) => { f.rounds[0].shots[1].sequence = 1; }, // repeats hole 1 sequence 1
      (f) => { f.rounds[0].shots[1].id = 's1'; }, // repeated id
      (f) => { Object.assign(f.rounds[0], { shots: 'many' }); },
    ];
    for (const mutate of cases) expect(parseMutated(mutate).ok).toBe(false);
  });

  it('rejects an invalid club bag', () => {
    for (const bag of [[], ['driver', 'driver'], ['wood5'], 'driver']) {
      expect(parseMutated((f) => { f.clubBag = bag; }).ok).toBe(false);
    }
  });
});

describe('restoring shots and the club bag', () => {
  let counter = 0;
  function fresh() {
    counter += 1;
    const db = new GolfDatabase(`backup-shots-${counter}`);
    return { roundRepo: createRoundRepository(db), settings: createSettingsRepository(db) };
  }

  function backupOf(): ReturnType<typeof parseBackup> {
    return parseBackup(serializeBackup(createBackup([makeData(true)], exportedAt, ['driver', 'pw'])));
  }

  it('imports the shots with the round and applies the bag on an empty device', async () => {
    const { roundRepo, settings } = fresh();
    const parsed = backupOf();
    if (!parsed.ok) throw new Error('parse failed');

    const summary = await restoreBackup(parsed.backup, roundRepo, settings);
    expect(summary).toEqual({ imported: 1, skipped: 0, failed: 0, clubBagRestored: true });
    expect((await roundRepo.getRoundShots('r1')).map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    expect(await settings.getClubBag()).toEqual(['driver', 'pw', 'putter']);
  });

  it('never overwrites a bag the device already has', async () => {
    const { roundRepo, settings } = fresh();
    await settings.saveClubBag(['iron7']);
    const parsed = backupOf();
    if (!parsed.ok) throw new Error('parse failed');

    const summary = await restoreBackup(parsed.backup, roundRepo, settings);
    expect(summary.clubBagRestored).toBeUndefined();
    expect(await settings.getClubBag()).toEqual(['iron7', 'putter']);
  });

  it('keeps the previous summary shape when no settings repository is passed', async () => {
    const { roundRepo } = fresh();
    const parsed = backupOf();
    if (!parsed.ok) throw new Error('parse failed');
    expect(await restoreBackup(parsed.backup, roundRepo)).toEqual({ imported: 1, skipped: 0, failed: 0 });
  });

  it('skips an existing round together with its shots', async () => {
    const { roundRepo, settings } = fresh();
    const parsed = backupOf();
    if (!parsed.ok) throw new Error('parse failed');
    await restoreBackup(parsed.backup, roundRepo, settings);
    const again = await restoreBackup(parsed.backup, roundRepo, settings);
    expect(again.skipped).toBe(1);
    expect(await roundRepo.getRoundShots('r1')).toHaveLength(3);
  });
});