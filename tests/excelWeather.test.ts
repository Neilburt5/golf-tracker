import { describe, expect, it } from 'vitest';
import { utils } from 'xlsx';
import type { Hole, Round, RoundWeather, RoundWithHoles } from '../src/domain/types';
import {
  WEATHER_COLUMNS,
  buildAllRoundsWorkbook,
  buildWeatherRow,
  buildWorkbook,
} from '../src/services/excelExport';

const round: Round = {
  id: 'r1',
  courseId: 'c1',
  courseName: 'Campo',
  date: '2026-10-01T08:30:00.000Z',
  tee: 'Blancas',
  numberOfHoles: 9,
  startHole: 1,
  status: 'finished',
  createdAt: '2026-10-01T08:30:00.000Z',
  updatedAt: '2026-10-01T11:00:00.000Z',
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

const weather: RoundWeather = {
  roundId: 'r1',
  source: 'open-meteo',
  latitude: 40.5,
  longitude: -3.5,
  windowStart: '2026-10-01T08:00:00.000Z',
  windowEnd: '2026-10-01T11:00:00.000Z',
  hours: 3,
  fetchedAt: '2026-10-02T00:00:00.000Z',
  temperatureC: 18.5,
  precipitationMm: 0.4,
  pressureHpa: 940,
  windSpeedKmh: 12,
  windDirectionDeg: null,
  windGustKmh: null,
};

describe('WEATHER sheet', () => {
  it('builds one row with the documented columns, empty cells for unknown values', () => {
    const row = buildWeatherRow(round, weather);
    expect(Object.keys(row)).toEqual([...WEATHER_COLUMNS]);
    expect(row['Round ID']).toBe('r1');
    expect(row['Temperature C']).toBe(18.5);
    expect(row['Wind Direction deg']).toBeNull();
    expect(row['Wind Gust kmh']).toBeNull();
    expect(row['Weather Hours']).toBe(3);
  });

  it('keeps ROUND and HOLES unchanged and adds WEATHER only when weather exists', () => {
    expect(buildWorkbook(round, holes).SheetNames).toEqual(['ROUND', 'HOLES']);

    const workbook = buildWorkbook(round, holes, weather);
    expect(workbook.SheetNames).toEqual(['ROUND', 'HOLES', 'WEATHER']);
    const rows = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.WEATHER);
    expect(rows).toHaveLength(1);
    expect(rows[0]['Round ID']).toBe('r1');
  });

  it('export-all includes one WEATHER row per finished round that has weather', () => {
    const second: RoundWithHoles = {
      round: { ...round, id: 'r2' },
      holes: holes.map((h) => ({ ...h, id: `${h.id}-2`, roundId: 'r2' })),
    };
    const first: RoundWithHoles = { round, holes, weather };

    const workbook = buildAllRoundsWorkbook([first, second]);
    expect(workbook.SheetNames).toEqual(['ROUND', 'HOLES', 'WEATHER']);
    expect(utils.sheet_to_json(workbook.Sheets.WEATHER)).toHaveLength(1);
    expect(utils.sheet_to_json(workbook.Sheets.ROUND)).toHaveLength(2);

    expect(buildAllRoundsWorkbook([second]).SheetNames).toEqual(['ROUND', 'HOLES']);
  });
});