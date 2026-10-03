import { describe, expect, it } from 'vitest';
import { read, utils } from 'xlsx';
import {
  buildHoleRows,
  buildRoundRow,
  buildWorkbook,
  createExcelFile,
  exportFilename,
  HOLE_COLUMNS,
  ROUND_COLUMNS,
  workbookToBytes,
  XLSX_MIME,
} from '../src/services/excelExport';
import type { Hole, Round } from '../src/domain/types';

const round: Round = {
  id: 'round-1',
  courseId: 'retamares',
  courseName: 'Club de Golf Retamares',
  date: '2026-03-01T12:00:00.000Z',
  tee: 'Amarillas',
  numberOfHoles: 18,
  startHole: 1,
  status: 'finished',
  createdAt: '2026-03-01T09:00:00.000Z',
  updatedAt: '2026-03-01T14:00:00.000Z',
};

function hole(holeNumber: number, overrides: Partial<Hole>): Hole {
  return {
    id: `hole-${holeNumber}`,
    roundId: round.id,
    holeNumber,
    par: 4,
    score: null,
    putts: 0,
    fairway: false,
    gir: false,
    penaltyStrokes: 0,
    bunker: false,
    upAndDown: null,
    ...overrides,
  };
}

// Hole 1: bogey, fairway hit, bunker, up & down made.
// Hole 2: par 3, par, GIR (no fairway, no up & down opportunity).
// Hole 3: triple on a par 5, 3-putt, penalty, up & down failed.
// Hole 4: not played.
const hole1 = hole(1, { par: 4, score: 5, putts: 2, fairway: true, bunker: true, upAndDown: true });
const hole2 = hole(2, { par: 3, score: 3, putts: 1, fairway: null, gir: true });
const hole3 = hole(3, { par: 5, score: 8, putts: 3, penaltyStrokes: 1, upAndDown: false });
const hole4 = hole(4, {});

describe('buildRoundRow', () => {
  it('summarises the played holes', () => {
    const row = buildRoundRow(round, [hole1, hole2, hole3, hole4]);

    expect(row).toEqual({
      'Round ID': 'round-1',
      Date: '2026-03-01',
      Course: 'Club de Golf Retamares',
      Tee: 'Amarillas',
      'Total Score': 16,
      'Total Par': 12,
      'Score To Par': 4,
      'Total Putts': 6,
      Fairways: 1,
      'Fairway Opportunities': 2,
      GIR: 1,
      'GIR Percentage': expect.closeTo(100 / 3),
      Penalties: 1,
      Bunkers: 1,
      'Up & Downs': 1,
      'Up & Down Attempts': 2,
      'Up & Down Percentage': 50,
      '3-Putts': 1,
    });
  });

  it('leaves percentages empty (null) when there is nothing to divide by', () => {
    const row = buildRoundRow(round, [hole4]);

    expect(row['GIR Percentage']).toBeNull();
    expect(row['Up & Down Percentage']).toBeNull();
    expect(row['Total Score']).toBe(0);
  });

  it('has exactly the columns of section 16, in order', () => {
    expect(Object.keys(buildRoundRow(round, []))).toEqual([...ROUND_COLUMNS]);
  });
});

describe('buildHoleRows', () => {
  it('exports one row per PLAYED hole, ordered by hole number', () => {
    const rows = buildHoleRows(round, [hole3, hole1, hole4, hole2]);

    expect(rows.map((r) => r.Hole)).toEqual([1, 2, 3]);
  });

  it('exports booleans as 1/0 and "not applicable" as null', () => {
    const [first, second, third] = buildHoleRows(round, [hole1, hole2, hole3]);

    expect(first).toEqual({
      'Round ID': 'round-1',
      Date: '2026-03-01',
      Course: 'Club de Golf Retamares',
      Hole: 1,
      Par: 4,
      Score: 5,
      'Score To Par': 1,
      Putts: 2,
      Fairway: 1,
      GIR: 0,
      Penalty: 0,
      Bunker: 1,
      'Up & Down': 1,
      '3-Putt': 0,
    });

    // Par 3: no fairway; no up & down opportunity.
    expect(second.Fairway).toBeNull();
    expect(second['Up & Down']).toBeNull();
    expect(second.GIR).toBe(1);
    expect(second['Score To Par']).toBe(0);

    expect(third.Fairway).toBe(0);
    expect(third['Up & Down']).toBe(0);
    expect(third['3-Putt']).toBe(1);
    expect(third.Penalty).toBe(1);
    expect(third['Score To Par']).toBe(3);
  });

  it('returns no rows when nothing has been played', () => {
    expect(buildHoleRows(round, [hole4])).toEqual([]);
  });

  it('has exactly the columns of section 16, in order', () => {
    const [row] = buildHoleRows(round, [hole1]);
    expect(Object.keys(row)).toEqual([...HOLE_COLUMNS]);
  });
});

describe('buildWorkbook', () => {
  const workbook = buildWorkbook(round, [hole1, hole2, hole3, hole4]);

  it('has the sheets ROUND and HOLES', () => {
    expect(workbook.SheetNames).toEqual(['ROUND', 'HOLES']);
  });

  it('writes the header row in column order', () => {
    const [header] = utils.sheet_to_json<string[]>(workbook.Sheets.HOLES, { header: 1 });
    expect(header).toEqual([...HOLE_COLUMNS]);
  });

  it('writes one data row in ROUND and one per played hole in HOLES', () => {
    expect(utils.sheet_to_json(workbook.Sheets.ROUND)).toHaveLength(1);
    expect(utils.sheet_to_json(workbook.Sheets.HOLES)).toHaveLength(3);
  });

  it('leaves "not applicable" cells really empty', () => {
    const rows = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.HOLES);
    const par3 = rows[1];

    expect(par3.Hole).toBe(2);
    expect('Fairway' in par3).toBe(false);
    expect('Up & Down' in par3).toBe(false);
    expect(par3.GIR).toBe(1);
  });

  it('writes a header-only HOLES sheet when nothing has been played', () => {
    const empty = buildWorkbook(round, [hole4]);
    expect(utils.sheet_to_json(empty.Sheets.HOLES)).toEqual([]);
    const [header] = utils.sheet_to_json<string[]>(empty.Sheets.HOLES, { header: 1 });
    expect(header).toEqual([...HOLE_COLUMNS]);
  });
});

describe('xlsx file', () => {
  it('serialises to a valid .xlsx that can be read back', () => {
    const bytes = workbookToBytes(buildWorkbook(round, [hole1, hole2, hole3]));

    // .xlsx is a zip archive: it starts with "PK".
    const header = new Uint8Array(bytes).slice(0, 2);
    expect(Array.from(header)).toEqual([0x50, 0x4b]);

    const reread = read(bytes, { type: 'array' });
    expect(reread.SheetNames).toEqual(['ROUND', 'HOLES']);
    const rows = utils.sheet_to_json<Record<string, unknown>>(reread.Sheets.HOLES);
    expect(rows).toHaveLength(3);
    expect(rows[0].Course).toBe('Club de Golf Retamares');
  });

  it('builds a named, typed file', () => {
    const { blob, filename } = createExcelFile(round, [hole1]);

    expect(blob.type).toBe(XLSX_MIME);
    expect(blob.size).toBeGreaterThan(0);
    expect(filename).toBe('golf-tracker-club-de-golf-retamares-2026-03-01.xlsx');
  });

  it('falls back to a generic course name when the slug is empty', () => {
    expect(exportFilename({ ...round, courseName: '???' })).toBe('golf-tracker-ronda-2026-03-01.xlsx');
  });
});