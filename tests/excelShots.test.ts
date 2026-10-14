import { describe, expect, it } from 'vitest';
import { utils } from 'xlsx';
import type { Hole, Round, RoundWithHoles, Shot, ShotFix } from '../src/domain/types';
import {
  SHOT_COLUMNS,
  buildAllRoundsWorkbook,
  buildShotRows,
  buildWorkbook,
} from '../src/services/excelExport';

const round: Round = {
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
};

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

function fix(latitude: number, accuracy = 4, fresh = true): ShotFix {
  return { latitude, longitude: -3.47, accuracy, fixedAt: '2026-10-14T09:00:00.000Z', fresh };
}

function shot(overrides: Partial<Shot>): Shot {
  return {
    id: 's',
    roundId: 'r1',
    holeNumber: 1,
    sequence: 1,
    club: 'driver',
    fix: fix(40.6),
    createdAt: '2026-10-14T09:00:00.000Z',
    ...overrides,
  };
}

const shots: Shot[] = [
  shot({ id: 'a', sequence: 1, club: 'driver', fix: fix(40.6) }),
  shot({ id: 'b', sequence: 2, club: 'iron7', fix: fix(40.601) }),
  shot({ id: 'c', sequence: 3, club: 'putter', fix: fix(40.6012) }),
  shot({ id: 'd', holeNumber: 2, sequence: 1, club: 'wedge56', fix: null }),
];

describe('SHOTS sheet', () => {
  it('builds one row per shot with the documented columns', () => {
    const rows = buildShotRows(round, shots);
    expect(rows).toHaveLength(4);
    expect(Object.keys(rows[0])).toEqual([...SHOT_COLUMNS]);
    expect(rows[0]['Round ID']).toBe('r1');
    expect(rows[0].Hole).toBe(1);
    expect(rows[0].Shot).toBe(1);
    expect(rows[0].Club).toBe('driver');
  });

  it('computes distance and uncertainty from the next fix, rounded to 0.1 m', () => {
    const [first] = buildShotRows(round, shots);
    expect(first['Distance m']).toBeCloseTo(111.2, 1);
    expect(first['Distance Uncertainty m']).toBe(8);
    expect(first.Approximate).toBe(0);
    expect(first['Fresh Fix']).toBe(1);
    expect(first['Accuracy m']).toBe(4);
    expect(first['Fix Time']).toBe('2026-10-14T09:00:00.000Z');
  });

  it('leaves empty cells for the putter marker, a missing fix and the last shot', () => {
    const rows = buildShotRows(round, shots);
    const putter = rows[2];
    expect(putter.Club).toBe('putter');
    expect(putter['Distance m']).toBeNull();
    expect(putter.Approximate).toBeNull();
    expect(putter.Latitude).not.toBeNull();

    const noFix = rows[3];
    expect(noFix.Latitude).toBeNull();
    expect(noFix.Longitude).toBeNull();
    expect(noFix['Accuracy m']).toBeNull();
    expect(noFix['Fix Time']).toBeNull();
    expect(noFix['Fresh Fix']).toBeNull();
    expect(noFix['Distance m']).toBeNull();
  });

  it('flags approximate for an uncertain or non-fresh pair', () => {
    const rows = buildShotRows(round, [
      shot({ id: 'a', sequence: 1, fix: fix(40.6, 12) }),
      shot({ id: 'b', sequence: 2, club: 'iron7', fix: fix(40.601, 12) }),
    ]);
    expect(rows[0].Approximate).toBe(1);
  });

  it('exports shots of holes that have no score yet', () => {
    const unplayed = holes.map((h) => ({ ...h, score: null }));
    const workbook = buildWorkbook(round, unplayed, undefined, shots);
    expect(utils.sheet_to_json(workbook.Sheets.SHOTS)).toHaveLength(4);
  });

  it('exports shots in hole and sequence order regardless of input order', () => {
    const rows = buildShotRows(round, [...shots].reverse());
    expect(rows.map((r) => [r.Hole, r.Shot])).toEqual([
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 1],
    ]);
  });
});

describe('workbook shape with shots', () => {
  it('adds SHOTS only when a shot exists; ROUND and HOLES are unchanged', () => {
    expect(buildWorkbook(round, holes).SheetNames).toEqual(['ROUND', 'HOLES']);
    expect(buildWorkbook(round, holes, undefined, []).SheetNames).toEqual(['ROUND', 'HOLES']);
    expect(buildWorkbook(round, holes, undefined, shots).SheetNames).toEqual([
      'ROUND',
      'HOLES',
      'SHOTS',
    ]);

    const withShots = buildWorkbook(round, holes, undefined, shots);
    const without = buildWorkbook(round, holes);
    expect(utils.sheet_to_json(withShots.Sheets.ROUND)).toEqual(utils.sheet_to_json(without.Sheets.ROUND));
    expect(utils.sheet_to_json(withShots.Sheets.HOLES)).toEqual(utils.sheet_to_json(without.Sheets.HOLES));
  });

  it('keeps the order ROUND, HOLES, WEATHER, SHOTS', () => {
    const weather = {
      roundId: 'r1',
      source: 'open-meteo' as const,
      latitude: 40.5,
      longitude: -3.5,
      windowStart: '2026-10-14T08:00:00.000Z',
      windowEnd: '2026-10-14T11:00:00.000Z',
      hours: 3,
      fetchedAt: '2026-10-15T00:00:00.000Z',
      temperatureC: 18,
      precipitationMm: 0,
      pressureHpa: 940,
      windSpeedKmh: 10,
      windDirectionDeg: 90,
      windGustKmh: null,
    };
    expect(buildWorkbook(round, holes, weather, shots).SheetNames).toEqual([
      'ROUND',
      'HOLES',
      'WEATHER',
      'SHOTS',
    ]);
  });

  it('export-all includes the shots of finished rounds only', () => {
    const finished: RoundWithHoles = { round, holes, shots };
    const inProgress: RoundWithHoles = {
      round: { ...round, id: 'r2', status: 'in_progress' },
      holes: holes.map((h) => ({ ...h, id: `${h.id}-2`, roundId: 'r2' })),
      shots: shots.map((s) => ({ ...s, id: `${s.id}-2`, roundId: 'r2' })),
    };
    const plain: RoundWithHoles = {
      round: { ...round, id: 'r3' },
      holes: holes.map((h) => ({ ...h, id: `${h.id}-3`, roundId: 'r3' })),
    };

    const workbook = buildAllRoundsWorkbook([finished, inProgress, plain]);
    expect(workbook.SheetNames).toEqual(['ROUND', 'HOLES', 'SHOTS']);
    const rows = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.SHOTS);
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((r) => r['Round ID']))).toEqual(new Set(['r1']));

    expect(buildAllRoundsWorkbook([plain]).SheetNames).toEqual(['ROUND', 'HOLES']);
  });
});