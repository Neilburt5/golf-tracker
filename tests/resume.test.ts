import { describe, expect, it } from 'vitest';
import { findResumeHoleNumber } from '../src/domain/resume';
import type { Hole } from '../src/domain/types';

function makeHole(holeNumber: number, score: number | null): Hole {
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

describe('findResumeHoleNumber', () => {
  it('returns null when there are no holes', () => {
    expect(findResumeHoleNumber([])).toBeNull();
  });

  it('returns the first hole when nothing has been played', () => {
    expect(findResumeHoleNumber([makeHole(1, null), makeHole(2, null)])).toBe(1);
  });

  it('returns the first hole without score, regardless of array order', () => {
    const holes = [makeHole(3, null), makeHole(1, 4), makeHole(2, 5)];
    expect(findResumeHoleNumber(holes)).toBe(3);
  });

  it('returns the first unplayed hole even if later holes have a score', () => {
    const holes = [makeHole(1, 4), makeHole(2, null), makeHole(3, 5)];
    expect(findResumeHoleNumber(holes)).toBe(2);
  });

  it('returns the last hole when every hole has a score', () => {
    const holes = [makeHole(10, 4), makeHole(11, 5), makeHole(12, 3)];
    expect(findResumeHoleNumber(holes)).toBe(12);
  });
});