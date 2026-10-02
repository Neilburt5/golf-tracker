import { describe, expect, it } from 'vitest';
import { unplayedHoles } from '../src/domain/calculations';
import { formatPercentage, formatToPar } from '../src/domain/format';
import type { Hole } from '../src/domain/types';

function hole(holeNumber: number, score: number | null): Hole {
  return {
    id: `h${holeNumber}`,
    roundId: 'r1',
    holeNumber,
    par: 4,
    score,
    putts: 0,
    fairway: false,
    gir: false,
    penaltyStrokes: 0,
    bunker: false,
    upAndDown: null,
  };
}

describe('unplayedHoles', () => {
  it('returns only holes without a saved score, in order', () => {
    const holes = [hole(1, 4), hole(2, null), hole(3, 5), hole(4, null)];
    expect(unplayedHoles(holes).map((h) => h.holeNumber)).toEqual([2, 4]);
  });

  it('returns an empty list when every hole has a score', () => {
    expect(unplayedHoles([hole(1, 4), hole(2, 3)])).toEqual([]);
  });
});

describe('formatToPar', () => {
  it('formats over, under and level par', () => {
    expect(formatToPar(2)).toBe('+2');
    expect(formatToPar(-1)).toBe('-1');
    expect(formatToPar(0)).toBe('Par');
    expect(formatToPar(null)).toBeUndefined();
  });
});

describe('formatPercentage', () => {
  it('rounds and handles null', () => {
    expect(formatPercentage(66.666)).toBe('67%');
    expect(formatPercentage(null)).toBe('—');
  });
});