import type { Hole } from '../src/domain/types';

export function makeHole(overrides: Partial<Hole> = {}): Hole {
  return {
    id: 'hole-1',
    roundId: 'round-1',
    holeNumber: 1,
    par: 4,
    score: 4,
    putts: 2,
    fairway: true,
    gir: true,
    penaltyStrokes: 0,
    bunker: false,
    upAndDown: null,
    ...overrides,
  };
}
