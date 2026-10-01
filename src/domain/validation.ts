import type { Hole, Round } from './types';

export type ValidationField = 'holeNumber' | 'par' | 'score' | 'putts' | 'penaltyStrokes';
export type ValidationCode = 'invalid_hole_number' | 'invalid_par' | 'score_required' | 'invalid_score' | 'invalid_putts' | 'invalid_penalty_strokes';

export interface ValidationError {
  field: ValidationField;
  code: ValidationCode;
}

type RoundShape = Pick<Round, 'startHole' | 'numberOfHoles'>;

const isInteger = Number.isInteger;

/** An 18-hole round must start at hole 1; a 9-hole round starts at 1 or 10. */
export function isValidRoundConfig(config: RoundShape): boolean {
  return config.numberOfHoles === 18 ? config.startHole === 1 : true;
}

export function isValidHoleNumber(holeNumber: number, round: RoundShape): boolean {
  return (
    isInteger(holeNumber) &&
    holeNumber >= round.startHole &&
    holeNumber <= round.startHole + round.numberOfHoles - 1
  );
}

/**
 * Returns all problems found (empty array = valid).
 * - requireScore: true when saving a hole ("Save & next"); false for autosave drafts.
 * Deliberately does NOT enforce putts <= score or similar rules (section 14).
 */
export function validateHole(
  hole: Pick<Hole, 'holeNumber' | 'par' | 'score' | 'putts' | 'penaltyStrokes'>,
  round: RoundShape,
  options: { requireScore: boolean },
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isValidHoleNumber(hole.holeNumber, round)) {
    errors.push({ field: 'holeNumber', code: 'invalid_hole_number' });
  }
  if (!isInteger(hole.par) || hole.par < 1) {
    errors.push({ field: 'par', code: 'invalid_par' });
  }
  if (hole.score === null) {
    if (options.requireScore) errors.push({ field: 'score', code: 'score_required' });
  } else if (!isInteger(hole.score) || hole.score < 1) {
    errors.push({ field: 'score', code: 'invalid_score' });
  }
  if (!isInteger(hole.putts) || hole.putts < 0) {
    errors.push({ field: 'putts', code: 'invalid_putts' });
  }
  if (!isInteger(hole.penaltyStrokes) || hole.penaltyStrokes < 0) {
    errors.push({ field: 'penaltyStrokes', code: 'invalid_penalty_strokes' });
  }

  return errors;
}