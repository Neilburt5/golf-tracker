import { utils, write, type WorkBook } from 'xlsx';
import {
  calculateRoundStats,
  holeScoreToPar,
  isPlayed,
  isThreePutt,
} from '../domain/calculations';
import type { Hole, Round } from '../domain/types';
import { localDateStamp, slugify } from './filenames';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Column order follows section 16 of PROMPT.md. */
export const ROUND_COLUMNS = [
  'Round ID',
  'Date',
  'Course',
  'Tee',
  'Total Score',
  'Total Par',
  'Score To Par',
  'Total Putts',
  'Fairways',
  'Fairway Opportunities',
  'GIR',
  'GIR Percentage',
  'Penalties',
  'Bunkers',
  'Up & Downs',
  'Up & Down Attempts',
  'Up & Down Percentage',
  '3-Putts',
] as const;

export const HOLE_COLUMNS = [
  'Round ID',
  'Date',
  'Course',
  'Hole',
  'Par',
  'Score',
  'Score To Par',
  'Putts',
  'Fairway',
  'GIR',
  'Penalty',
  'Bunker',
  'Up & Down',
  '3-Putt',
] as const;

/** null = empty cell ("not applicable" or nothing to divide by). */
export type ExportCell = string | number | null;

export type RoundRow = Record<(typeof ROUND_COLUMNS)[number], ExportCell>;
export type HoleRow = Record<(typeof HOLE_COLUMNS)[number], ExportCell>;

/** Booleans are exported as 1/0. */
function flag(value: boolean): 1 | 0 {
  return value ? 1 : 0;
}

/** Booleans that can be "not applicable": 1/0, or an empty cell. */
function nullableFlag(value: boolean | null): 1 | 0 | null {
  return value === null ? null : flag(value);
}

/** The ROUND sheet row. Statistics only count played holes (see calculateRoundStats). */
export function buildRoundRow(round: Round, holes: readonly Hole[]): RoundRow {
  const stats = calculateRoundStats(holes);
  return {
    'Round ID': round.id,
    Date: localDateStamp(round.date),
    Course: round.courseName,
    Tee: round.tee,
    'Total Score': stats.totalScore,
    'Total Par': stats.totalPar,
    'Score To Par': stats.scoreToPar,
    'Total Putts': stats.totalPutts,
    Fairways: stats.fairwaysHit,
    'Fairway Opportunities': stats.fairwayOpportunities,
    GIR: stats.girCount,
    'GIR Percentage': stats.girPercentage,
    Penalties: stats.penaltyStrokes,
    Bunkers: stats.bunkers,
    'Up & Downs': stats.upAndDownMade,
    'Up & Down Attempts': stats.upAndDownAttempts,
    'Up & Down Percentage': stats.upAndDownPercentage,
    '3-Putts': stats.threePutts,
  };
}

/** The HOLES sheet rows: one row per PLAYED hole, ordered by hole number. */
export function buildHoleRows(round: Round, holes: readonly Hole[]): HoleRow[] {
  const date = localDateStamp(round.date);
  return holes
    .filter(isPlayed)
    .sort((a, b) => a.holeNumber - b.holeNumber)
    .map((hole) => ({
      'Round ID': round.id,
      Date: date,
      Course: round.courseName,
      Hole: hole.holeNumber,
      Par: hole.par,
      Score: hole.score,
      'Score To Par': holeScoreToPar(hole),
      Putts: hole.putts,
      Fairway: nullableFlag(hole.fairway),
      GIR: flag(hole.gir),
      Penalty: hole.penaltyStrokes,
      Bunker: flag(hole.bunker),
      'Up & Down': nullableFlag(hole.upAndDown),
      '3-Putt': flag(isThreePutt(hole)),
    }));
}

/**
 * Header row + data rows as an array of arrays.
 * aoa_to_sheet leaves null cells empty, which is what "not applicable" needs.
 */
function toSheetData<K extends string>(
  columns: readonly K[],
  rows: readonly Record<K, ExportCell>[],
): ExportCell[][] {
  return [[...columns], ...rows.map((row) => columns.map((column) => row[column]))];
}

/** Workbook with sheets ROUND (one row) and HOLES (one row per played hole). */
export function buildWorkbook(round: Round, holes: readonly Hole[]): WorkBook {
  const workbook = utils.book_new();

  const roundSheet = utils.aoa_to_sheet(toSheetData(ROUND_COLUMNS, [buildRoundRow(round, holes)]));
  const holesSheet = utils.aoa_to_sheet(toSheetData(HOLE_COLUMNS, buildHoleRows(round, holes)));

  utils.book_append_sheet(workbook, roundSheet, 'ROUND');
  utils.book_append_sheet(workbook, holesSheet, 'HOLES');
  return workbook;
}

/** Serialises a workbook to .xlsx bytes. */
export function workbookToBytes(workbook: WorkBook): ArrayBuffer {
  return write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

/** "golf-tracker-club-de-golf-retamares-2026-03-01.xlsx" */
export function exportFilename(round: Round): string {
  const course = slugify(round.courseName) || 'ronda';
  return `golf-tracker-${course}-${localDateStamp(round.date)}.xlsx`;
}

/** Builds the .xlsx file for a round. Synchronous so it can run inside a tap handler. */
export function createExcelFile(
  round: Round,
  holes: readonly Hole[],
): { blob: Blob; filename: string } {
  const bytes = workbookToBytes(buildWorkbook(round, holes));
  return { blob: new Blob([bytes], { type: XLSX_MIME }), filename: exportFilename(round) };
}