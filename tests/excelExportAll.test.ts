import { describe, expect, it } from 'vitest';
import { read, utils } from 'xlsx';
import type { Hole, Round, RoundWithHoles } from '../src/domain/types';
import {
  ALL_ROUNDS_FILENAME,
  buildAllRoundsWorkbook,
  createAllRoundsExcelFile,
  HOLE_COLUMNS,
  ROUND_COLUMNS,
  selectRoundsForExport,
  workbookToBytes,
  XLSX_MIME,
} from '../src/services/excelExport';

function makeRound(id: string, date: string, overrides: Partial<Round> = {}): Round {
  return {
    id,
    courseId: 'retamares',
    courseName: 'Club de Golf Retamares',
    date,
    tee: 'Amarillas',
    numberOfHoles: 18,
    startHole: 1,
    status: 'finished',
    createdAt: date,
    updatedAt: date,
    ...overrides,
  };
}

function makeHole(roundId: string, holeNumber: number, overrides: Partial<Hole> = {}): Hole {
  return {
    id: `${roundId}-hole-${holeNumber}`,
    roundId,
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

/** Holes start..start+count-1; the first `played` of them have a score (par 4, bogey, 2 putts). */
function makeHoles(roundId: string, start: number, count: number, played: number): Hole[] {
  return Array.from({ length: count }, (_, i) =>
    makeHole(
      roundId,
      start + i,
      i < played ? { score: 5, putts: 2, fairway: true } : {},
    ),
  );
}

// Round E: finished, nothing played (2026-02-01).
const roundE: RoundWithHoles = {
  round: makeRound('e', '2026-02-01T10:00:00.000Z', { numberOfHoles: 9 }),
  holes: makeHoles('e', 1, 9, 0),
};

// Round B: front nine, all played, hole 2 is a par 3 (2026-03-01).
const roundB: RoundWithHoles = {
  round: makeRound('b', '2026-03-01T10:00:00.000Z', { numberOfHoles: 9 }),
  holes: makeHoles('b', 1, 9, 9).map((h) =>
    h.holeNumber === 2 ? { ...h, par: 3, score: 3, putts: 1, fairway: null, gir: true } : h,
  ),
};

// Round C: back nine (holes 10-18), all played (2026-03-08).
const roundC: RoundWithHoles = {
  round: makeRound('c', '2026-03-08T10:00:00.000Z', { numberOfHoles: 9, startHole: 10 }),
  holes: makeHoles('c', 10, 9, 9),
};

// Round A: 18 holes, only the first 3 played (2026-03-15).
const roundA: RoundWithHoles = {
  round: makeRound('a', '2026-03-15T10:00:00.000Z'),
  holes: makeHoles('a', 1, 18, 3),
};

// Round D: in progress, must never be exported (2026-03-20).
const roundD: RoundWithHoles = {
  round: makeRound('d', '2026-03-20T10:00:00.000Z', { status: 'in_progress' }),
  holes: makeHoles('d', 1, 18, 5),
};

// The repository returns newest first.
const fromRepository = [roundD, roundA, roundC, roundB, roundE];

describe('selectRoundsForExport', () => {
  it('keeps finished rounds only and orders them ascending by date', () => {
    const ids = selectRoundsForExport(fromRepository).map((r) => r.round.id);
    expect(ids).toEqual(['e', 'b', 'c', 'a']);
  });

  it('breaks date ties with createdAt, then id', () => {
    const sameDay = '2026-04-01T10:00:00.000Z';
    const late = { round: makeRound('x', sameDay, { createdAt: '2026-04-01T18:00:00.000Z' }), holes: [] };
    const early = { round: makeRound('y', sameDay, { createdAt: '2026-04-01T08:00:00.000Z' }), holes: [] };
    const tieA = { round: makeRound('a1', sameDay, { createdAt: sameDay }), holes: [] };
    const tieB = { round: makeRound('a2', sameDay, { createdAt: sameDay }), holes: [] };

    const ids = selectRoundsForExport([late, tieB, early, tieA]).map((r) => r.round.id);
    expect(ids).toEqual(['y', 'a1', 'a2', 'x']);
  });

  it('does not mutate its input', () => {
    const input = [...fromRepository];
    selectRoundsForExport(input);
    expect(input).toEqual(fromRepository);
  });

  it('returns an empty list when there are no finished rounds', () => {
    expect(selectRoundsForExport([roundD])).toEqual([]);
    expect(selectRoundsForExport([])).toEqual([]);
  });
});

describe('buildAllRoundsWorkbook', () => {
  const workbook = buildAllRoundsWorkbook(fromRepository);
  const roundRows = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.ROUND);
  const holeRows = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.HOLES);

  it('has the sheets ROUND and HOLES', () => {
    expect(workbook.SheetNames).toEqual(['ROUND', 'HOLES']);
  });

  it('writes one ROUND row per finished round, ascending by date, without in-progress rounds', () => {
    expect(roundRows.map((r) => r['Round ID'])).toEqual(['e', 'b', 'c', 'a']);
    expect(roundRows.map((r) => r.Date)).toEqual([
      '2026-02-01',
      '2026-03-01',
      '2026-03-08',
      '2026-03-15',
    ]);
  });

  it('writes one HOLES row per played hole across 9 and 18-hole rounds', () => {
    // e: 0 played, b: 9, c: 9, a: 3 of 18.
    expect(holeRows).toHaveLength(21);
    expect(holeRows.map((r) => r['Round ID'])).toEqual([
      ...Array(9).fill('b'),
      ...Array(9).fill('c'),
      ...Array(3).fill('a'),
    ]);
  });

  it('keeps real hole numbers: the back nine is 10-18', () => {
    const backNine = holeRows.filter((r) => r['Round ID'] === 'c').map((r) => r.Hole);
    expect(backNine).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  it('does not export unplayed holes, and the ROUND row counts only played ones', () => {
    const aHoles = holeRows.filter((r) => r['Round ID'] === 'a').map((r) => r.Hole);
    expect(aHoles).toEqual([1, 2, 3]);

    const aRow = roundRows.find((r) => r['Round ID'] === 'a');
    expect(aRow?.['Total Score']).toBe(15);
    expect(aRow?.['Total Par']).toBe(12);
    expect(aRow?.['Score To Par']).toBe(3);
  });

  it('leaves "not applicable" and zero-denominator cells really empty', () => {
    const par3 = holeRows.find((r) => r['Round ID'] === 'b' && r.Hole === 2);
    expect(par3?.GIR).toBe(1);
    expect('Fairway' in (par3 ?? {})).toBe(false);
    expect('Up & Down' in (par3 ?? {})).toBe(false);

    // Round E has nothing played: row exists, totals are 0, percentages are empty.
    const eRow = roundRows.find((r) => r['Round ID'] === 'e');
    expect(eRow?.['Total Score']).toBe(0);
    expect('GIR Percentage' in (eRow ?? {})).toBe(false);
    expect('Up & Down Percentage' in (eRow ?? {})).toBe(false);
  });

  it('keeps the column order of section 16', () => {
    const [roundHeader] = utils.sheet_to_json<string[]>(workbook.Sheets.ROUND, { header: 1 });
    const [holeHeader] = utils.sheet_to_json<string[]>(workbook.Sheets.HOLES, { header: 1 });
    expect(roundHeader).toEqual([...ROUND_COLUMNS]);
    expect(holeHeader).toEqual([...HOLE_COLUMNS]);
  });

  it('writes header-only sheets when there are no finished rounds', () => {
    const empty = buildAllRoundsWorkbook([roundD]);
    expect(utils.sheet_to_json(empty.Sheets.ROUND)).toEqual([]);
    expect(utils.sheet_to_json(empty.Sheets.HOLES)).toEqual([]);
    const [header] = utils.sheet_to_json<string[]>(empty.Sheets.ROUND, { header: 1 });
    expect(header).toEqual([...ROUND_COLUMNS]);
  });
});

describe('createAllRoundsExcelFile', () => {
  it('builds a typed file with the fixed filename', () => {
    const { blob, filename } = createAllRoundsExcelFile(fromRepository);

    expect(blob.type).toBe(XLSX_MIME);
    expect(blob.size).toBeGreaterThan(0);
    expect(filename).toBe(ALL_ROUNDS_FILENAME);
    expect(filename).toBe('golf-tracker-todas-las-rondas.xlsx');
  });

  it('serialises to a valid .xlsx that can be read back', () => {
    const bytes = workbookToBytes(buildAllRoundsWorkbook(fromRepository));

    const header = new Uint8Array(bytes).slice(0, 2);
    expect(Array.from(header)).toEqual([0x50, 0x4b]); // "PK"

    const reread = read(bytes, { type: 'array' });
    expect(reread.SheetNames).toEqual(['ROUND', 'HOLES']);
    expect(utils.sheet_to_json(reread.Sheets.ROUND)).toHaveLength(4);
    expect(utils.sheet_to_json(reread.Sheets.HOLES)).toHaveLength(21);
  });
});