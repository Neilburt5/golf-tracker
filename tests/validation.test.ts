import { describe, expect, it } from 'vitest';
import { isValidHoleNumber, isValidRoundConfig, validateHole } from '../src/domain/validation';
import { makeHole } from './factories';

const front9 = { startHole: 1, numberOfHoles: 9 } as const;
const back9 = { startHole: 10, numberOfHoles: 9 } as const;
const full18 = { startHole: 1, numberOfHoles: 18 } as const;

describe('isValidHoleNumber', () => {
  it('accepts only holes inside the round', () => {
    expect(isValidHoleNumber(1, front9)).toBe(true);
    expect(isValidHoleNumber(9, front9)).toBe(true);
    expect(isValidHoleNumber(10, front9)).toBe(false);
    expect(isValidHoleNumber(9, back9)).toBe(false);
    expect(isValidHoleNumber(10, back9)).toBe(true);
    expect(isValidHoleNumber(18, back9)).toBe(true);
    expect(isValidHoleNumber(18, full18)).toBe(true);
    expect(isValidHoleNumber(0, full18)).toBe(false);
    expect(isValidHoleNumber(1.5, full18)).toBe(false);
  });
});

describe('isValidRoundConfig', () => {
  it('rejects an 18-hole round starting at hole 10', () => {
    expect(isValidRoundConfig({ numberOfHoles: 18, startHole: 10 })).toBe(false);
    expect(isValidRoundConfig({ numberOfHoles: 18, startHole: 1 })).toBe(true);
    expect(isValidRoundConfig({ numberOfHoles: 9, startHole: 10 })).toBe(true);
  });
});

describe('validateHole', () => {
  it('accepts a normal hole', () => {
    expect(validateHole(makeHole(), full18, { requireScore: true })).toEqual([]);
  });

  it('requires a score when saving, but not for autosave drafts', () => {
    const hole = makeHole({ score: null });
    expect(validateHole(hole, full18, { requireScore: true })).toEqual([
      { field: 'score', code: 'score_required' },
    ]);
    expect(validateHole(hole, full18, { requireScore: false })).toEqual([]);
  });

  it('rejects score < 1 and non-integers', () => {
    expect(validateHole(makeHole({ score: 0 }), full18, { requireScore: true })).toContainEqual({ field: 'score', code: 'invalid_score' });
    expect(validateHole(makeHole({ score: 4.5 }), full18, { requireScore: true })).toContainEqual({ field: 'score', code: 'invalid_score' });
  });

  it('rejects negative putts and penalties but allows zero', () => {
    const bad = makeHole({ putts: -1, penaltyStrokes: -1 });
    const errors = validateHole(bad, full18, { requireScore: true });
    expect(errors).toContainEqual({ field: 'putts', code: 'invalid_putts' });
    expect(errors).toContainEqual({ field: 'penaltyStrokes', code: 'invalid_penalty_strokes' });
    expect(validateHole(makeHole({ putts: 0, penaltyStrokes: 0 }), full18, { requireScore: true })).toEqual([]);
  });

  it('rejects a hole number outside the round', () => {
    expect(validateHole(makeHole({ holeNumber: 12 }), front9, { requireScore: true })).toContainEqual({ field: 'holeNumber', code: 'invalid_hole_number' });
  });

  it('does NOT block unusual but possible situations', () => {
    // more putts than score: chip-in is impossible here, but we never block it
    const odd = makeHole({ score: 2, putts: 3 });
    expect(validateHole(odd, full18, { requireScore: true })).toEqual([]);
  });
});