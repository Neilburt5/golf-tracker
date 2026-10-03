import type { RoundRepository } from '../data/roundRepository';
import { holeNumbersFor } from '../domain/calculations';
import type { Hole, Round, RoundWithHoles } from '../domain/types';
import { localDateStamp } from './filenames';

export const BACKUP_APP = 'golf-tracker';
/** Bump when the backup format changes in a way older readers cannot understand. */
export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_MIME = 'application/json';

export interface BackupFile {
  app: string;
  schemaVersion: number;
  exportedAt: string; // ISO
  rounds: RoundWithHoles[];
}

// ---------------------------------------------------------------------------
// Creating a backup
// ---------------------------------------------------------------------------

export function createBackup(rounds: readonly RoundWithHoles[], exportedAt: string): BackupFile {
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    rounds: [...rounds],
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** "golf-tracker-backup-2026-04-01.json" */
export function backupFilename(exportedAt: string): string {
  return `golf-tracker-backup-${localDateStamp(exportedAt)}.json`;
}

/** Builds the backup file. Synchronous so it can run inside a tap handler (iOS share sheet). */
export function createBackupFile(
  rounds: readonly RoundWithHoles[],
  exportedAt: string = new Date().toISOString(),
): { blob: Blob; filename: string } {
  const backup = createBackup(rounds, exportedAt);
  return {
    blob: new Blob([serializeBackup(backup)], { type: BACKUP_MIME }),
    filename: backupFilename(exportedAt),
  };
}

// ---------------------------------------------------------------------------
// Reading a backup (the file is untrusted input: validate everything)
// ---------------------------------------------------------------------------

export type BackupErrorCode =
  | 'not_json'
  | 'wrong_app'
  | 'unsupported_version'
  | 'invalid_structure';

export type ParseBackupResult =
  | { ok: true; backup: BackupFile }
  | { ok: false; code: BackupErrorCode; detail: string };

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function pass<T>(value: T): Parsed<T> {
  return { ok: true, value };
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isInteger(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min;
}

function isBooleanOrNull(value: unknown): value is boolean | null {
  return value === null || typeof value === 'boolean';
}

function parseRound(raw: unknown, path: string): Parsed<Round> {
  if (!isObject(raw)) return fail(`${path} must be an object`);

  const { id, courseId, courseName, date, tee, numberOfHoles, startHole, status } = raw;
  const { createdAt, updatedAt } = raw;

  if (!isNonEmptyString(id)) return fail(`${path}.id is required`);
  if (!isNonEmptyString(courseId)) return fail(`${path}.courseId is required`);
  if (!isNonEmptyString(courseName)) return fail(`${path}.courseName is required`);
  if (!isDateString(date)) return fail(`${path}.date must be a date`);
  if (!isNonEmptyString(tee)) return fail(`${path}.tee is required`);
  if (numberOfHoles !== 9 && numberOfHoles !== 18) {
    return fail(`${path}.numberOfHoles must be 9 or 18`);
  }
  if (startHole !== 1 && startHole !== 10) return fail(`${path}.startHole must be 1 or 10`);
  if (status !== 'in_progress' && status !== 'finished') {
    return fail(`${path}.status must be "in_progress" or "finished"`);
  }
  if (!isDateString(createdAt)) return fail(`${path}.createdAt must be a date`);
  if (!isDateString(updatedAt)) return fail(`${path}.updatedAt must be a date`);

  // Only known fields are kept; anything else in the file is ignored.
  return pass({
    id,
    courseId,
    courseName,
    date,
    tee,
    numberOfHoles,
    startHole,
    status,
    createdAt,
    updatedAt,
  });
}

function parseHole(raw: unknown, roundId: string, path: string): Parsed<Hole> {
  if (!isObject(raw)) return fail(`${path} must be an object`);

  const { id, holeNumber, par, score, putts, fairway, gir } = raw;
  const { penaltyStrokes, bunker, upAndDown } = raw;

  if (!isNonEmptyString(id)) return fail(`${path}.id is required`);
  if (raw.roundId !== roundId) return fail(`${path}.roundId does not match its round`);
  if (!isInteger(holeNumber, 1) || holeNumber > 18) {
    return fail(`${path}.holeNumber must be an integer from 1 to 18`);
  }
  if (!isInteger(par, 3) || par > 6) return fail(`${path}.par must be an integer from 3 to 6`);
  if (score !== null && !isInteger(score, 1)) {
    return fail(`${path}.score must be null or an integer >= 1`);
  }
  if (!isInteger(putts, 0)) return fail(`${path}.putts must be an integer >= 0`);
  if (!isBooleanOrNull(fairway)) return fail(`${path}.fairway must be true, false or null`);
  if (typeof gir !== 'boolean') return fail(`${path}.gir must be true or false`);
  if (!isInteger(penaltyStrokes, 0)) {
    return fail(`${path}.penaltyStrokes must be an integer >= 0`);
  }
  if (typeof bunker !== 'boolean') return fail(`${path}.bunker must be true or false`);
  if (!isBooleanOrNull(upAndDown)) return fail(`${path}.upAndDown must be true, false or null`);

  return pass({
    id,
    roundId,
    holeNumber,
    par,
    score,
    putts,
    fairway,
    gir,
    penaltyStrokes,
    bunker,
    upAndDown,
  });
}

function parseRoundWithHoles(raw: unknown, path: string): Parsed<RoundWithHoles> {
  if (!isObject(raw)) return fail(`${path} must be an object`);

  const round = parseRound(raw.round, `${path}.round`);
  if (!round.ok) return round;

  const rawHoles = raw.holes;
  if (!Array.isArray(rawHoles)) return fail(`${path}.holes must be an array`);
  const holeList: unknown[] = rawHoles;

  const holes: Hole[] = [];
  for (let index = 0; index < holeList.length; index++) {
    const hole = parseHole(holeList[index], round.value.id, `${path}.holes[${index}]`);
    if (!hole.ok) return hole;
    holes.push(hole.value);
  }
  holes.sort((a, b) => a.holeNumber - b.holeNumber);

  // The round must contain exactly its own holes, one each (e.g. 10..18 for a back nine).
  const expected = holeNumbersFor(round.value.startHole, round.value.numberOfHoles);
  const matches =
    holes.length === expected.length && holes.every((hole, i) => hole.holeNumber === expected[i]);
  if (!matches) {
    return fail(
      `${path}.holes must be exactly holes ${expected[0]} to ${expected[expected.length - 1]}, one each`,
    );
  }

  return pass({ round: round.value, holes });
}

/** Parses and validates the text of a backup file. Never touches the database. */
export function parseBackup(text: string): ParseBackupResult {
  const invalid = (detail: string): ParseBackupResult => ({
    ok: false,
    code: 'invalid_structure',
    detail,
  });

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, code: 'not_json', detail: 'The file is not valid JSON' };
  }

  if (!isObject(raw)) return invalid('The file must contain a JSON object');

  if (raw.app !== BACKUP_APP) {
    return { ok: false, code: 'wrong_app', detail: 'This is not a Golf Tracker backup' };
  }

  const schemaVersion = raw.schemaVersion;
  if (!isInteger(schemaVersion, 1)) return invalid('schemaVersion must be a positive integer');
  if (schemaVersion > BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      code: 'unsupported_version',
      detail: `Backup version ${schemaVersion} is newer than this app supports (${BACKUP_SCHEMA_VERSION})`,
    };
  }

  const exportedAt = raw.exportedAt;
  if (!isDateString(exportedAt)) return invalid('exportedAt must be a date');

  const rawRounds = raw.rounds;
  if (!Array.isArray(rawRounds)) return invalid('rounds must be an array');
  const roundList: unknown[] = rawRounds;

  const rounds: RoundWithHoles[] = [];
  const seenRoundIds = new Set<string>();
  const seenHoleIds = new Set<string>();

  for (let index = 0; index < roundList.length; index++) {
    const path = `rounds[${index}]`;
    const parsed = parseRoundWithHoles(roundList[index], path);
    if (!parsed.ok) return invalid(parsed.error);

    const { round, holes } = parsed.value;
    if (seenRoundIds.has(round.id)) return invalid(`${path}.round.id is duplicated`);
    seenRoundIds.add(round.id);

    for (const hole of holes) {
      // A repeated hole id would make the database reject the whole round.
      if (seenHoleIds.has(hole.id)) return invalid(`${path} has a hole id used more than once`);
      seenHoleIds.add(hole.id);
    }
    rounds.push(parsed.value);
  }

  return { ok: true, backup: { app: BACKUP_APP, schemaVersion, exportedAt, rounds } };
}

// ---------------------------------------------------------------------------
// Restoring a backup
// ---------------------------------------------------------------------------

export interface RestoreSummary {
  /** Rounds written to the database. */
  imported: number;
  /** Rounds that already existed and were left untouched. */
  skipped: number;
  /** Rounds that could not be written (nothing of them was saved). */
  failed: number;
}

/**
 * Inserts the rounds of a validated backup. Never overwrites an existing round.
 * One failing round does not stop the others.
 */
export async function restoreBackup(
  backup: BackupFile,
  repository: Pick<RoundRepository, 'importRound'>,
): Promise<RestoreSummary> {
  const summary: RestoreSummary = { imported: 0, skipped: 0, failed: 0 };

  for (const data of backup.rounds) {
    try {
      const result = await repository.importRound(data);
      if (result === 'imported') summary.imported += 1;
      else summary.skipped += 1;
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}