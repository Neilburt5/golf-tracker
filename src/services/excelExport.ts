import { utils, write, type WorkBook } from 'xlsx';
import {
  calculateRoundStats,
  holeScoreToPar,
  isPlayed,
  isThreePutt,
} from '../domain/calculations';
import { withShotDistances } from '../domain/shots';
import type { Hole, Round, RoundWeather, RoundWithHoles, Shot } from '../domain/types';
import { localDateStamp, slugify } from './filenames';


export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Fixed name for the "export all" file, so the user can choose "Replace" in Files (D24). */
export const ALL_ROUNDS_FILENAME = 'golf-tracker-todas-las-rondas.xlsx';

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

/** WEATHER sheet: one row per round with weather, joined to ROUND by Round ID (D45). */
export const WEATHER_COLUMNS = [
  'Round ID',
  'Date',
  'Course',
  'Temperature C',
  'Precipitation mm',
  'Pressure hPa',
  'Wind Speed kmh',
  'Wind Direction deg',
  'Wind Gust kmh',
  'Weather Hours',
  'Window Start',
  'Window End',
] as const;

export type WeatherRow = Record<(typeof WEATHER_COLUMNS)[number], ExportCell>;

/** Window times are UTC ISO text. Wind direction is where the wind comes from; empty when unknown. */
export function buildWeatherRow(round: Round, weather: RoundWeather): WeatherRow {
  return {
    'Round ID': round.id,
    Date: localDateStamp(round.date),
    Course: round.courseName,
    'Temperature C': weather.temperatureC,
    'Precipitation mm': weather.precipitationMm,
    'Pressure hPa': weather.pressureHpa,
    'Wind Speed kmh': weather.windSpeedKmh,
    'Wind Direction deg': weather.windDirectionDeg,
    'Wind Gust kmh': weather.windGustKmh,
    'Weather Hours': weather.hours,
    'Window Start': weather.windowStart,
    'Window End': weather.windowEnd,
  };
}

/**
 * SHOTS sheet: one row per recorded shot, joined to ROUND by Round ID and to HOLES by
 * Round ID + Hole (phase 16). `Club` is the stable code (e.g. "iron7", "wedge56"), not the
 * Spanish label. Putter rows are position markers: they have no distance.
 */
export const SHOT_COLUMNS = [
  'Round ID',
  'Date',
  'Course',
  'Hole',
  'Shot',
  'Club',
  'Latitude',
  'Longitude',
  'Accuracy m',
  'Fix Time',
  'Fresh Fix',
  'Distance m',
  'Distance Uncertainty m',
  'Approximate',
] as const;

export type ShotRow = Record<(typeof SHOT_COLUMNS)[number], ExportCell>;

/** Meters are exported with one decimal; phone GPS does not justify more. */
function meters(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The SHOTS rows of one round, ordered by hole and shot number. Every recorded shot is
 * exported, also on holes without a score: a shot is real data, not an empty row (unlike D18).
 * Cells that cannot be computed (no fix, last shot, putter marker) are empty.
 */
export function buildShotRows(round: Round, shots: readonly Shot[]): ShotRow[] {
  const date = localDateStamp(round.date);
  return withShotDistances(shots).map(({ shot, distance }) => ({
    'Round ID': round.id,
    Date: date,
    Course: round.courseName,
    Hole: shot.holeNumber,
    Shot: shot.sequence,
    Club: shot.club,
    Latitude: shot.fix ? shot.fix.latitude : null,
    Longitude: shot.fix ? shot.fix.longitude : null,
    'Accuracy m': shot.fix ? meters(shot.fix.accuracy) : null,
    'Fix Time': shot.fix ? shot.fix.fixedAt : null,
    'Fresh Fix': shot.fix ? flag(shot.fix.fresh) : null,
    'Distance m': distance ? meters(distance.meters) : null,
    'Distance Uncertainty m': distance ? meters(distance.uncertaintyM) : null,
    Approximate: distance ? flag(distance.approximate) : null,
  }));
}

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

/**
 * Workbook with sheets ROUND and HOLES, plus WEATHER and SHOTS only when there is at least one
 * row for them, so files without that data keep exactly the previous shape. Sheet order is
 * ROUND, HOLES, WEATHER, SHOTS. Shared by both export modes.
 */
function workbookFromRows(
  roundRows: readonly RoundRow[],
  holeRows: readonly HoleRow[],
  weatherRows: readonly WeatherRow[] = [],
  shotRows: readonly ShotRow[] = [],
): WorkBook {
  const workbook = utils.book_new();

  const roundSheet = utils.aoa_to_sheet(toSheetData(ROUND_COLUMNS, roundRows));
  const holesSheet = utils.aoa_to_sheet(toSheetData(HOLE_COLUMNS, holeRows));

  utils.book_append_sheet(workbook, roundSheet, 'ROUND');
  utils.book_append_sheet(workbook, holesSheet, 'HOLES');

  if (weatherRows.length > 0) {
    const weatherSheet = utils.aoa_to_sheet(toSheetData(WEATHER_COLUMNS, weatherRows));
    utils.book_append_sheet(workbook, weatherSheet, 'WEATHER');
  }
  if (shotRows.length > 0) {
    const shotsSheet = utils.aoa_to_sheet(toSheetData(SHOT_COLUMNS, shotRows));
    utils.book_append_sheet(workbook, shotsSheet, 'SHOTS');
  }
  return workbook;
}

/**
 * Workbook for ONE round: ROUND (one row), HOLES (one row per played hole), WEATHER if known,
 * SHOTS if any shot was recorded.
 */
export function buildWorkbook(
  round: Round,
  holes: readonly Hole[],
  weather?: RoundWeather,
  shots: readonly Shot[] = [],
): WorkBook {
  return workbookFromRows(
    [buildRoundRow(round, holes)],
    buildHoleRows(round, holes),
    weather ? [buildWeatherRow(round, weather)] : [],
    buildShotRows(round, shots),
  );
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Rounds that go into the "export all" file (D24): finished rounds only, ascending
 * by date, then by creation time, then by id so the order is always stable.
 * Does not mutate its input.
 */
export function selectRoundsForExport(rounds: readonly RoundWithHoles[]): RoundWithHoles[] {
  return rounds
    .filter(({ round }) => round.status === 'finished')
    .sort(
      (a, b) =>
        compareText(a.round.date, b.round.date) ||
        compareText(a.round.createdAt, b.round.createdAt) ||
        compareText(a.round.id, b.round.id),
    );
}

/**
 * Workbook for ALL finished rounds: ROUND (one row per round) and HOLES (one row
 * per played hole of those rounds), WEATHER and SHOTS when those rounds have any.
 * Reuses the single-round row builders.
 */
export function buildAllRoundsWorkbook(rounds: readonly RoundWithHoles[]): WorkBook {
  const selected = selectRoundsForExport(rounds);
  return workbookFromRows(
    selected.map(({ round, holes }) => buildRoundRow(round, holes)),
    selected.flatMap(({ round, holes }) => buildHoleRows(round, holes)),
    selected.flatMap(({ round, weather }) => (weather ? [buildWeatherRow(round, weather)] : [])),
    selected.flatMap(({ round, shots }) => (shots ? buildShotRows(round, shots) : [])),
  );
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
  weather?: RoundWeather,
  shots: readonly Shot[] = [],
): { blob: Blob; filename: string } {
  const bytes = workbookToBytes(buildWorkbook(round, holes, weather, shots));
  return { blob: new Blob([bytes], { type: XLSX_MIME }), filename: exportFilename(round) };
}

/**
 * Builds the .xlsx file with every finished round and a fixed filename (D24).
 * Synchronous so it can run inside a tap handler (D21).
 */
export function createAllRoundsExcelFile(
  rounds: readonly RoundWithHoles[],
): { blob: Blob; filename: string } {
  const bytes = workbookToBytes(buildAllRoundsWorkbook(rounds));
  return { blob: new Blob([bytes], { type: XLSX_MIME }), filename: ALL_ROUNDS_FILENAME };
}