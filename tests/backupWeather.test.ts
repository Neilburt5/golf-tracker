import { describe, expect, it } from 'vitest';
import type { Hole, RoundWeather, RoundWithHoles } from '../src/domain/types';
import {
  BACKUP_SCHEMA_VERSION,
  createBackup,
  parseBackup,
  serializeBackup,
} from '../src/services/backup';

const weather: RoundWeather = {
  roundId: 'r1',
  source: 'open-meteo',
  latitude: 40.5,
  longitude: -3.5,
  windowStart: '2026-10-01T08:00:00.000Z',
  windowEnd: '2026-10-01T13:00:00.000Z',
  hours: 5,
  fetchedAt: '2026-10-02T00:00:00.000Z',
  temperatureC: 18.5,
  precipitationMm: 0,
  pressureHpa: 940,
  windSpeedKmh: 12,
  windDirectionDeg: 225,
  windGustKmh: null,
};

function makeData(withWeather: boolean): RoundWithHoles {
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
      date: '2026-10-01T08:30:00.000Z',
      tee: 'Blancas',
      numberOfHoles: 9,
      startHole: 1,
      status: 'finished',
      createdAt: '2026-10-01T08:30:00.000Z',
      updatedAt: '2026-10-01T11:00:00.000Z',
    },
    holes,
  };
  return withWeather ? { ...data, weather } : data;
}

const exportedAt = '2026-10-02T10:00:00.000Z';

describe('backup with weather (schemaVersion 2)', () => {
  it('writes the current schema version', () => {
    expect(BACKUP_SCHEMA_VERSION).toBe(2);
    expect(createBackup([makeData(true)], exportedAt).schemaVersion).toBe(2);
  });

  it('round-trips the weather', () => {
    const text = serializeBackup(createBackup([makeData(true)], exportedAt));
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.backup.rounds[0].weather).toEqual(weather);
  });

  it('still accepts a schemaVersion 1 file without weather', () => {
    const file = JSON.parse(serializeBackup(createBackup([makeData(false)], exportedAt)));
    file.schemaVersion = 1;
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.backup.rounds[0].weather).toBeUndefined();
  });

  it('rejects a newer schema version', () => {
    const file = JSON.parse(serializeBackup(createBackup([makeData(true)], exportedAt)));
    file.schemaVersion = 3;
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.code).toBe('unsupported_version');
  });

  it('rejects weather that belongs to another round or has bad values', () => {
    const wrongRound = JSON.parse(serializeBackup(createBackup([makeData(true)], exportedAt)));
    wrongRound.rounds[0].weather.roundId = 'other';
    expect(parseBackup(JSON.stringify(wrongRound)).ok).toBe(false);

    const badValue = JSON.parse(serializeBackup(createBackup([makeData(true)], exportedAt)));
    badValue.rounds[0].weather.temperatureC = 'hot';
    expect(parseBackup(JSON.stringify(badValue)).ok).toBe(false);
  });
});