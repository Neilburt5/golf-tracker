import { describe, expect, it } from 'vitest';
import {
  calculateRoundStats,
  holeNumbersFor,
  holeScoreToPar,
  isThreePutt,
  percentage,
  suggestGir,
} from '../src/domain/calculations';
import { makeHole } from './factories';

describe('suggestGir', () => {
  it.each([
    // score, putts, par, expected
    [4, 2, 4, true], // regulation par
    [5, 2, 4, false], // 3 strokes to reach the green on a par 4
    [3, 2, 3, true],
    [3, 1, 3, false], // missed the green, chipped close
    [1, 0, 3, true], // hole in one
    [5, 2, 5, true],
    [3, 0, 4, false], // holed out from off the green
  ])('score %i, putts %i, par %i -> %s', (score, putts, par, expected) => {
    expect(suggestGir(score, putts, par)).toBe(expected);
  });
});

describe('hole helpers', () => {
  it('detects 3-putts from putts >= 3', () => {
    expect(isThreePutt({ putts: 2 })).toBe(false);
    expect(isThreePutt({ putts: 3 })).toBe(true);
    expect(isThreePutt({ putts: 4 })).toBe(true);
  });

  it('computes score to par, or null when unscored', () => {
    expect(holeScoreToPar(makeHole({ par: 4, score: 6 }))).toBe(2);
    expect(holeScoreToPar(makeHole({ par: 4, score: 3 }))).toBe(-1);
    expect(holeScoreToPar(makeHole({ score: null }))).toBeNull();
  });

  it('lists real course hole numbers for a round', () => {
    expect(holeNumbersFor(1, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(holeNumbersFor(10, 9)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(holeNumbersFor(1, 18)).toHaveLength(18);
  });

  it('returns null percentage when there is no denominator', () => {
    expect(percentage(0, 0)).toBeNull();
    expect(percentage(1, 4)).toBe(25);
  });
});

describe('calculateRoundStats', () => {
  const holes = [
    makeHole({ holeNumber: 1, par: 4, score: 5, putts: 2, fairway: true, gir: false, bunker: false, upAndDown: true }),
    makeHole({ holeNumber: 2, par: 3, score: 3, putts: 3, fairway: null, gir: true, bunker: true, upAndDown: null }),
    makeHole({ holeNumber: 3, par: 5, score: 7, putts: 1, fairway: false, gir: false, penaltyStrokes: 1, bunker: true, upAndDown: false }),
    makeHole({ holeNumber: 4, par: 4, score: null }), // not played yet
  ];

  const stats = calculateRoundStats(holes);

  it('totals only played holes', () => {
    expect(stats.holesPlayed).toBe(3);
    expect(stats.totalScore).toBe(15);
    expect(stats.totalPar).toBe(12);
    expect(stats.scoreToPar).toBe(3);
    expect(stats.totalPutts).toBe(6);
  });

  it('counts fairways against applicable holes only', () => {
    expect(stats.fairwaysHit).toBe(1);
    expect(stats.fairwayOpportunities).toBe(2);
  });

  it('computes GIR count and percentage', () => {
    expect(stats.girCount).toBe(1);
    expect(stats.girPercentage).toBeCloseTo(100 / 3);
  });

  it('computes up & down attempts, made and percentage', () => {
    expect(stats.upAndDownAttempts).toBe(2);
    expect(stats.upAndDownMade).toBe(1);
    expect(stats.upAndDownPercentage).toBe(50);
  });

  it('counts penalties, bunkers and 3-putts', () => {
    expect(stats.penaltyStrokes).toBe(1);
    expect(stats.bunkers).toBe(2);
    expect(stats.threePutts).toBe(1);
  });

  it('handles an empty round without dividing by zero', () => {
    const empty = calculateRoundStats([]);
    expect(empty.holesPlayed).toBe(0);
    expect(empty.totalScore).toBe(0);
    expect(empty.scoreToPar).toBe(0);
    expect(empty.girPercentage).toBeNull();
    expect(empty.upAndDownPercentage).toBeNull();
  });

  it('updates when a previous hole is edited (totals are derived)', () => {
    const edited = holes.map((h) => (h.holeNumber === 1 ? { ...h, score: 4 } : h));
    expect(calculateRoundStats(edited).totalScore).toBe(14);
  });
});