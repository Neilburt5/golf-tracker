import { describe, expect, it } from 'vitest';
import { findResumeHoleNumber, findResumeTarget, resumePath } from '../src/domain/resume';
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

describe('findResumeTarget (D62)', () => {
  it('returns null when there are no holes', () => {
    expect(findResumeTarget([])).toBeNull();
  });

  it('opens the shots screen of the first unplayed hole', () => {
    const holes = [makeHole(1, 4), makeHole(2, null), makeHole(3, 5)];
    expect(findResumeTarget(holes)).toEqual({ holeNumber: 2, screen: 'shots' });
  });

  it('opens the hole screen of the last hole when everything is played', () => {
    const holes = [makeHole(10, 4), makeHole(11, 5)];
    expect(findResumeTarget(holes)).toEqual({ holeNumber: 11, screen: 'hole' });
  });
});

describe('resumePath', () => {
  it('builds the route of each screen', () => {
    expect(resumePath('r1', { holeNumber: 7, screen: 'shots' })).toBe('/round/r1/hole/7/shots');
    expect(resumePath('r1', { holeNumber: 18, screen: 'hole' })).toBe('/round/r1/hole/18');
  });
});