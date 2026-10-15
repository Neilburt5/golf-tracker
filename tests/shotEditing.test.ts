import { describe, expect, it } from 'vitest';
import {
  appendShot,
  attachFix,
  changeClub,
  createShotInput,
  removeShot,
} from '../src/domain/shotEditing';
import type { ShotFix } from '../src/domain/types';

const fix: ShotFix = {
  latitude: 40.6,
  longitude: -3.47,
  accuracy: 5,
  fixedAt: '2026-10-15T09:00:00.000Z',
  fresh: true,
};

const a = createShotInput('a', 'driver', '2026-10-15T09:00:00.000Z');
const b = createShotInput('b', 'iron7', '2026-10-15T09:02:00.000Z');

describe('shotEditing', () => {
  it('creates a shot without a position', () => {
    expect(a).toEqual({ id: 'a', club: 'driver', fix: null, createdAt: '2026-10-15T09:00:00.000Z' });
  });

  it('appends at the end without mutating the input', () => {
    const list = [a];
    const result = appendShot(list, b);
    expect(result.map((s) => s.id)).toEqual(['a', 'b']);
    expect(list).toHaveLength(1);
  });

  it('changes only the club of the given shot and keeps its fix', () => {
    const withFix = { ...a, fix };
    const result = changeClub([withFix, b], 'a', 'wood3');
    expect(result[0]).toEqual({ ...withFix, club: 'wood3' });
    expect(result[1]).toEqual(b);
  });

  it('removes a shot and leaves the rest in order', () => {
    expect(removeShot([a, b], 'a').map((s) => s.id)).toEqual(['b']);
  });

  it('attaches a fix to the given shot', () => {
    const result = attachFix([a, b], 'b', fix);
    expect(result[0].fix).toBeNull();
    expect(result[1].fix).toEqual(fix);
  });

  it('ignores a late fix for a shot that was deleted', () => {
    const result = attachFix([b], 'a', fix);
    expect(result).toEqual([b]);
  });

  it('ignores unknown ids on edit and delete', () => {
    expect(changeClub([a], 'zzz', 'pw')).toEqual([a]);
    expect(removeShot([a], 'zzz')).toEqual([a]);
  });
});