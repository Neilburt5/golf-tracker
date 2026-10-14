import { describe, expect, it } from 'vitest';
import {
  APPROXIMATE_UNCERTAINTY_M,
  reconcileHole,
  validateShot,
  withShotDistances,
} from '../src/domain/shots';
import type { Shot, ShotFix } from '../src/domain/types';

const round = { startHole: 1 as const, numberOfHoles: 18 as const };

function fix(overrides: Partial<ShotFix> = {}): ShotFix {
  return {
    latitude: 40.6,
    longitude: -3.47,
    accuracy: 4,
    fixedAt: '2026-10-14T09:00:00.000Z',
    fresh: true,
    ...overrides,
  };
}

function shot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: 's1',
    roundId: 'r1',
    holeNumber: 1,
    sequence: 1,
    club: 'driver',
    fix: fix(),
    createdAt: '2026-10-14T09:00:00.000Z',
    ...overrides,
  };
}

describe('validateShot', () => {
  it('accepts a normal shot, with or without a fix', () => {
    expect(validateShot(shot(), round)).toEqual([]);
    expect(validateShot(shot({ fix: null }), round)).toEqual([]);
  });

  it('rejects a hole number outside the round', () => {
    const back = { startHole: 10 as const, numberOfHoles: 9 as const };
    expect(validateShot(shot({ holeNumber: 3 }), back).map((e) => e.code)).toEqual([
      'invalid_hole_number',
    ]);
    expect(validateShot(shot({ holeNumber: 12 }), back)).toEqual([]);
  });

  it('rejects a bad sequence, club, fix or date', () => {
    expect(validateShot(shot({ sequence: 0 }), round)[0].code).toBe('invalid_sequence');
    expect(validateShot(shot({ sequence: 1.5 }), round)[0].code).toBe('invalid_sequence');
    expect(validateShot(shot({ club: 'wood5' as never }), round)[0].code).toBe('invalid_club');
    expect(validateShot(shot({ fix: fix({ latitude: 91 }) }), round)[0].code).toBe('invalid_fix');
    expect(validateShot(shot({ fix: fix({ longitude: -181 }) }), round)[0].code).toBe('invalid_fix');
    expect(validateShot(shot({ fix: fix({ accuracy: -1 }) }), round)[0].code).toBe('invalid_fix');
    expect(validateShot(shot({ fix: fix({ accuracy: NaN }) }), round)[0].code).toBe('invalid_fix');
    expect(validateShot(shot({ fix: fix({ fixedAt: 'yesterday' }) }), round)[0].code).toBe(
      'invalid_fix',
    );
    expect(validateShot(shot({ createdAt: 'nope' }), round)[0].code).toBe('invalid_created_at');
  });

  it('has no limit on shots per hole', () => {
    expect(validateShot(shot({ sequence: 40 }), round)).toEqual([]);
  });
});

describe('reconcileHole (D37)', () => {
  const hole = (score: number | null, putts = 2, penaltyStrokes = 0) => ({
    score,
    putts,
    penaltyStrokes,
  });

  it('is not a mismatch when the hole has no shots', () => {
    const result = reconcileHole(hole(5), []);
    expect(result.status).toBe('not_tracked');
    expect(result.difference).toBeNull();
  });

  it('is not comparable while the hole has no score', () => {
    expect(reconcileHole(hole(null), [{ club: 'driver' }]).status).toBe('not_played');
  });

  it('matches: shots + putts + penalties = score, putter markers not counted', () => {
    const shots = [{ club: 'driver' as const }, { club: 'iron7' as const }, { club: 'putter' as const }];
    const result = reconcileHole(hole(4, 2), shots);
    expect(result).toEqual({ status: 'match', recorded: 2, expected: 4, difference: 0 });
  });

  it('counts penalty strokes', () => {
    const shots = [{ club: 'driver' as const }, { club: 'iron7' as const }];
    expect(reconcileHole(hole(5, 2, 1), shots).status).toBe('match');
  });

  it('reports missing shots when the score is higher', () => {
    const result = reconcileHole(hole(6, 2), [{ club: 'driver' }, { club: 'putter' }]);
    expect(result).toEqual({ status: 'missing', recorded: 1, expected: 3, difference: 3 });
  });

  it('reports extra shots when the score is lower', () => {
    const shots = [{ club: 'driver' as const }, { club: 'iron7' as const }, { club: 'iron9' as const }];
    const result = reconcileHole(hole(4, 2), shots);
    expect(result.status).toBe('extra');
    expect(result.difference).toBe(-1);
  });
});

describe('withShotDistances (D32, D40)', () => {
  // 0.001 degrees of latitude is about 111.2 m
  const a = fix({ latitude: 40.6 });
  const b = fix({ latitude: 40.601 });

  it('uses the distance to the next fix of the same hole and sums both accuracies', () => {
    const result = withShotDistances([
      shot({ id: 'a', sequence: 1, fix: a }),
      shot({ id: 'b', sequence: 2, club: 'iron7', fix: b }),
    ]);
    expect(result[0].distance?.meters).toBeCloseTo(111.2, 0);
    expect(result[0].distance?.uncertaintyM).toBe(8);
    expect(result[0].distance?.approximate).toBe(false);
    expect(result[1].distance).toBeNull(); // last shot
  });

  it('orders by sequence regardless of the input order and does not mutate it', () => {
    const input = [
      shot({ id: 'b', sequence: 2, club: 'iron7', fix: b }),
      shot({ id: 'a', sequence: 1, fix: a }),
    ];
    const result = withShotDistances(input);
    expect(result.map((r) => r.shot.id)).toEqual(['a', 'b']);
    expect(input.map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('gives a putter marker as the end point but never a distance of its own', () => {
    const result = withShotDistances([
      shot({ id: 'a', sequence: 1, fix: a }),
      shot({ id: 'p', sequence: 2, club: 'putter', fix: b }),
    ]);
    expect(result[0].distance).not.toBeNull();
    expect(result[1].distance).toBeNull();
  });

  it('is null when either fix is missing', () => {
    const missingFirst = withShotDistances([
      shot({ id: 'a', sequence: 1, fix: null }),
      shot({ id: 'b', sequence: 2, fix: b }),
    ]);
    expect(missingFirst[0].distance).toBeNull();

    const missingSecond = withShotDistances([
      shot({ id: 'a', sequence: 1, fix: a }),
      shot({ id: 'b', sequence: 2, fix: null }),
    ]);
    expect(missingSecond[0].distance).toBeNull();
  });

  it('never measures across holes', () => {
    const result = withShotDistances([
      shot({ id: 'a', holeNumber: 1, sequence: 1, fix: a }),
      shot({ id: 'b', holeNumber: 2, sequence: 1, fix: b }),
    ]);
    expect(result.every((r) => r.distance === null)).toBe(true);
  });

  it('flags approximate above the uncertainty limit, not at it', () => {
    expect(APPROXIMATE_UNCERTAINTY_M).toBe(20);
    const at = withShotDistances([
      shot({ id: 'a', sequence: 1, fix: fix({ latitude: 40.6, accuracy: 10 }) }),
      shot({ id: 'b', sequence: 2, fix: fix({ latitude: 40.601, accuracy: 10 }) }),
    ]);
    expect(at[0].distance?.approximate).toBe(false);

    const above = withShotDistances([
      shot({ id: 'a', sequence: 1, fix: fix({ latitude: 40.6, accuracy: 10 }) }),
      shot({ id: 'b', sequence: 2, fix: fix({ latitude: 40.601, accuracy: 10.5 }) }),
    ]);
    expect(above[0].distance?.approximate).toBe(true);
  });

  it('flags approximate when either fix is not fresh, even if accurate', () => {
    const result = withShotDistances([
      shot({ id: 'a', sequence: 1, fix: fix({ latitude: 40.6, accuracy: 3 }) }),
      shot({ id: 'b', sequence: 2, fix: fix({ latitude: 40.601, accuracy: 3, fresh: false }) }),
    ]);
    expect(result[0].distance?.approximate).toBe(true);
  });
});