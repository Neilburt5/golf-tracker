import { describe, expect, it } from 'vitest';
import { formatGpsState, formatReconciliation, formatShotDistance } from '../src/domain/shotFormat';
import type { ShotFix } from '../src/domain/types';

const fix = (overrides: Partial<ShotFix> = {}): ShotFix => ({
  latitude: 40.6,
  longitude: -3.47,
  accuracy: 4.2,
  fixedAt: '2026-10-15T09:00:00.000Z',
  fresh: true,
  ...overrides,
});

describe('formatShotDistance', () => {
  it('shows a dash when there is no distance', () => {
    expect(formatShotDistance(null)).toBe('—');
  });

  it('rounds meters and uncertainty', () => {
    expect(formatShotDistance({ meters: 211.6, uncertaintyM: 8.4, approximate: false })).toBe(
      '212 m ± 8',
    );
  });

  it('flags approximate distances', () => {
    expect(formatShotDistance({ meters: 40, uncertaintyM: 30, approximate: true })).toBe(
      '40 m ± 30 · aprox.',
    );
  });
});

describe('formatGpsState', () => {
  it('shows capturing first', () => {
    expect(formatGpsState({ capturing: true, fix: null })).toBe('Tomando posición…');
  });

  it('shows the accuracy of a fresh fix', () => {
    expect(formatGpsState({ capturing: false, fix: fix() })).toBe('GPS ±4 m');
  });

  it('marks a best-effort fix as approximate', () => {
    expect(formatGpsState({ capturing: false, fix: fix({ accuracy: 21, fresh: false }) })).toBe(
      'GPS ±21 m · aproximada',
    );
  });

  it('explains why there is no position when it is known', () => {
    expect(formatGpsState({ capturing: false, fix: null, failure: 'permission_denied' })).toBe(
      'Sin posición (permiso denegado)',
    );
    expect(formatGpsState({ capturing: false, fix: null, failure: 'only_stale' })).toBe(
      'Sin posición (señal antigua)',
    );
  });

  it('falls back to a plain text when the reason is unknown', () => {
    expect(formatGpsState({ capturing: false, fix: null })).toBe('Sin posición');
  });
});

describe('formatReconciliation', () => {
  const base = { recorded: 0, expected: 0 };

  it('covers every status', () => {
    expect(formatReconciliation({ ...base, status: 'not_tracked', difference: null })).toBe(
      'Sin golpes registrados',
    );
    expect(formatReconciliation({ ...base, status: 'not_played', difference: null })).toBe(
      'Se comparará cuando guardes el score',
    );
    expect(formatReconciliation({ ...base, status: 'match', difference: 0 })).toBe(
      'Cuadra con el score',
    );
  });

  it('uses singular and plural', () => {
    expect(formatReconciliation({ ...base, status: 'missing', difference: 1 })).toBe(
      'Faltan 1 golpe',
    );
    expect(formatReconciliation({ ...base, status: 'missing', difference: 3 })).toBe(
      'Faltan 3 golpes',
    );
    expect(formatReconciliation({ ...base, status: 'extra', difference: -1 })).toBe('Sobra 1 golpe');
    expect(formatReconciliation({ ...base, status: 'extra', difference: -2 })).toBe(
      'Sobran 2 golpes',
    );
  });
});