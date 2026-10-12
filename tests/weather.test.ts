import { describe, expect, it } from 'vitest';
import {
  chooseWeatherSource,
  compassDirection,
  isWindowOver,
  summarizeWeather,
  weatherWindow,
  type HourlySample,
} from '../src/domain/weather';

const at = (hour: number) => Date.parse(`2026-10-01T${String(hour).padStart(2, '0')}:00:00.000Z`);

function sample(hour: number, overrides: Partial<HourlySample> = {}): HourlySample {
  return {
    time: at(hour),
    temperatureC: 20,
    precipitationMm: 0,
    pressureHpa: 940,
    windSpeedKmh: 10,
    windDirectionDeg: 90,
    windGustKmh: 15,
    ...overrides,
  };
}

const window18 = weatherWindow({ date: '2026-10-01T08:30:00.000Z', numberOfHoles: 18 })!;

describe('weatherWindow', () => {
  it('starts on the hour and lasts 5 h for 18 holes', () => {
    expect(window18).toEqual({
      start: '2026-10-01T08:00:00.000Z',
      end: '2026-10-01T13:00:00.000Z',
      hours: 5,
    });
  });

  it('lasts 3 h for 9 holes', () => {
    const window = weatherWindow({ date: '2026-10-01T08:30:00.000Z', numberOfHoles: 9 })!;
    expect(window.hours).toBe(3);
    expect(window.end).toBe('2026-10-01T11:00:00.000Z');
  });

  it('returns null for an invalid date', () => {
    expect(weatherWindow({ date: 'nope', numberOfHoles: 18 })).toBeNull();
  });
});

describe('isWindowOver / chooseWeatherSource', () => {
  it('is over exactly at the end of the window', () => {
    expect(isWindowOver(window18, '2026-10-01T12:59:59.000Z')).toBe(false);
    expect(isWindowOver(window18, '2026-10-01T13:00:00.000Z')).toBe(true);
  });

  it('uses the forecast API for recent rounds and the archive for old ones', () => {
    expect(chooseWeatherSource(window18, '2026-10-10T00:00:00.000Z')).toBe('forecast');
    expect(chooseWeatherSource(window18, '2027-03-01T00:00:00.000Z')).toBe('archive');
  });
});

describe('summarizeWeather', () => {
  it('only uses slots with start < time <= end', () => {
    const samples = [8, 9, 10, 11, 12, 13, 14].map((hour) =>
      sample(hour, { temperatureC: hour, precipitationMm: hour === 14 ? 9 : 0 }),
    );
    const summary = summarizeWeather(samples, window18)!;
    expect(summary.hours).toBe(5);
    expect(summary.temperatureC).toBe(11); // mean of 9..13
    expect(summary.precipitationMm).toBe(0); // the 14:00 slot is outside the window
  });

  it('sums precipitation, takes the max gust and skips null values', () => {
    const samples = [
      sample(9, { temperatureC: null }),
      sample(10, { temperatureC: 12, precipitationMm: 0.2 }),
      sample(11, { temperatureC: 14, windGustKmh: 30 }),
      sample(12, { temperatureC: 16, precipitationMm: 0.3 }),
    ];
    const summary = summarizeWeather(samples, window18)!;
    expect(summary.temperatureC).toBe(14);
    expect(summary.precipitationMm).toBe(0.5);
    expect(summary.windGustKmh).toBe(30);
    expect(summary.hours).toBe(4);
  });

  it('averages directions as vectors (350° and 10° give north)', () => {
    const samples = [sample(9, { windDirectionDeg: 350 }), sample(10, { windDirectionDeg: 10 })];
    expect(summarizeWeather(samples, window18)!.windDirectionDeg).toBe(0);
  });

  it('returns a null direction when the wind is calm', () => {
    const samples = [sample(9, { windSpeedKmh: 0 }), sample(10, { windSpeedKmh: 0 })];
    expect(summarizeWeather(samples, window18)!.windDirectionDeg).toBeNull();
  });

  it('returns null without enough data', () => {
    expect(summarizeWeather([], window18)).toBeNull();
    expect(summarizeWeather([sample(9, { temperatureC: null })], window18)).toBeNull();
    expect(summarizeWeather([sample(20)], window18)).toBeNull();
  });
});

describe('compassDirection', () => {
  it('maps degrees to Spanish compass points', () => {
    expect(compassDirection(0)).toBe('N');
    expect(compassDirection(45)).toBe('NE');
    expect(compassDirection(225)).toBe('SO');
    expect(compassDirection(270)).toBe('O');
    expect(compassDirection(315)).toBe('NO');
    expect(compassDirection(359)).toBe('N');
  });
});