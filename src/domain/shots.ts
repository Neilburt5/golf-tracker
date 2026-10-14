import { isClubCode, isPutter } from './clubs';
import { distanceMeters } from './gpsLog';
import type { Hole, Round, Shot, ShotFix } from './types';
import { isValidHoleNumber } from './validation';

/**
 * Pure rules for shots (phase 16). No React, no IndexedDB.
 * Shot capture never blocks anything: nothing here is used to reject a hole (D37).
 */

/**
 * A distance whose uncertainty (sum of the two accuracies, D40) is larger than this is
 * flagged approximate. 20 m is about 10 m per fix. On the 2026-10-11 test site the sums were
 * 28-43 m; on the course fixes of 3-4 m are expected (about 8 m). Revisit in phase 20.
 */
export const APPROXIMATE_UNCERTAINTY_M = 20;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function isValidShotFix(fix: unknown): fix is ShotFix {
  if (typeof fix !== 'object' || fix === null) return false;
  const { latitude, longitude, accuracy, fixedAt, fresh } = fix as Record<string, unknown>;
  return (
    isFiniteNumber(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    isFiniteNumber(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    isFiniteNumber(accuracy) &&
    accuracy >= 0 &&
    isDateString(fixedAt) &&
    typeof fresh === 'boolean'
  );
}

export type ShotValidationField = 'holeNumber' | 'sequence' | 'club' | 'fix' | 'createdAt';
export type ShotValidationCode =
  | 'invalid_hole_number'
  | 'invalid_sequence'
  | 'invalid_club'
  | 'invalid_fix'
  | 'invalid_created_at';

export interface ShotValidationError {
  field: ShotValidationField;
  code: ShotValidationCode;
}

/**
 * Returns every problem found (empty array = valid). Deliberately no limit on the number of
 * shots per hole and no rule that depends on the score (section 14, D37).
 */
export function validateShot(
  shot: Pick<Shot, 'holeNumber' | 'sequence' | 'club' | 'fix' | 'createdAt'>,
  round: Pick<Round, 'startHole' | 'numberOfHoles'>,
): ShotValidationError[] {
  const errors: ShotValidationError[] = [];

  if (!isValidHoleNumber(shot.holeNumber, round)) {
    errors.push({ field: 'holeNumber', code: 'invalid_hole_number' });
  }
  if (!Number.isInteger(shot.sequence) || shot.sequence < 1) {
    errors.push({ field: 'sequence', code: 'invalid_sequence' });
  }
  if (!isClubCode(shot.club)) {
    errors.push({ field: 'club', code: 'invalid_club' });
  }
  if (shot.fix !== null && !isValidShotFix(shot.fix)) {
    errors.push({ field: 'fix', code: 'invalid_fix' });
  }
  if (!isDateString(shot.createdAt)) {
    errors.push({ field: 'createdAt', code: 'invalid_created_at' });
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Reconciliation with the score (D37)
// ---------------------------------------------------------------------------

/**
 * - not_tracked: no shots recorded on this hole (shot capture is optional; not a mismatch).
 * - not_played: shots exist but the hole has no score yet.
 * - match: the shots explain the score.
 * - missing: the score is higher than the shots explain (a tap was probably forgotten).
 * - extra: the shots explain more strokes than the score (a tap was probably repeated).
 */
export type ReconciliationStatus = 'not_tracked' | 'not_played' | 'match' | 'missing' | 'extra';

export interface Reconciliation {
  status: ReconciliationStatus;
  /** Shots that count as strokes (putter markers excluded). */
  recorded: number;
  /** recorded + putts + penalty strokes. */
  expected: number;
  /** score - expected (positive = strokes missing from the shots). Null when not comparable. */
  difference: number | null;
}

/**
 * Compares the recorded shots with `score`, which stays the source of truth (D37).
 * `score` already includes penalty strokes, so expected = shots + putts + penalties.
 * Never throws and never blocks saving: the result is only shown.
 */
export function reconcileHole(
  hole: Pick<Hole, 'score' | 'putts' | 'penaltyStrokes'>,
  shots: readonly Pick<Shot, 'club'>[],
): Reconciliation {
  const recorded = shots.filter((shot) => !isPutter(shot.club)).length;
  const expected = recorded + hole.putts + hole.penaltyStrokes;

  if (shots.length === 0) return { status: 'not_tracked', recorded, expected, difference: null };
  if (hole.score === null) return { status: 'not_played', recorded, expected, difference: null };

  const difference = hole.score - expected;
  const status = difference === 0 ? 'match' : difference > 0 ? 'missing' : 'extra';
  return { status, recorded, expected, difference };
}

// ---------------------------------------------------------------------------
// Distances (D32, D40)
// ---------------------------------------------------------------------------

export interface ShotDistance {
  /** Straight-line distance between this shot's fix and the next shot's fix. */
  meters: number;
  /** Sum of the two accuracies (D40). The true distance is expected to stay within it. */
  uncertaintyM: number;
  /** Uncertainty above the limit, or either fix is not fresh (best effort). */
  approximate: boolean;
}

export interface ShotWithDistance {
  shot: Shot;
  /** Null when it cannot be computed: last shot, putter marker, or a missing fix. */
  distance: ShotDistance | null;
}

function distanceToNext(shot: Shot, next: Shot | undefined): ShotDistance | null {
  if (isPutter(shot.club) || !next) return null;
  if (next.roundId !== shot.roundId || next.holeNumber !== shot.holeNumber) return null;
  if (!shot.fix || !next.fix) return null;

  const uncertaintyM = shot.fix.accuracy + next.fix.accuracy;
  return {
    meters: distanceMeters(shot.fix, next.fix),
    uncertaintyM,
    approximate: uncertaintyM > APPROXIMATE_UNCERTAINTY_M || !shot.fix.fresh || !next.fix.fresh,
  };
}

/**
 * Orders shots by hole and sequence and derives each shot's distance from the next fix of
 * the same hole. Pure: does not mutate its input. Putter markers are never given a distance.
 */
export function withShotDistances(shots: readonly Shot[]): ShotWithDistance[] {
  const sorted = [...shots].sort(
    (a, b) => a.holeNumber - b.holeNumber || a.sequence - b.sequence,
  );
  return sorted.map((shot, index) => ({ shot, distance: distanceToNext(shot, sorted[index + 1]) }));
}