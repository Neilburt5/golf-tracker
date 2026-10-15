import { roundHolePath, roundShotsPath } from './paths';
import type { Hole } from './types';

/** Which screen of a hole "Continue round" reopens. */
export type ResumeScreen = 'shots' | 'hole';

export interface ResumeTarget {
  holeNumber: number;
  screen: ResumeScreen;
}

/**
 * Where to reopen a round (D13, D62): the shots screen of the first hole without a saved
 * score, or the hole screen of the last hole if every hole already has a score.
 * Null if there are no holes.
 */
export function findResumeTarget(holes: Hole[]): ResumeTarget | null {
  if (holes.length === 0) return null;
  const ordered = [...holes].sort((a, b) => a.holeNumber - b.holeNumber);
  const firstUnplayed = ordered.find((hole) => hole.score === null);
  if (firstUnplayed) return { holeNumber: firstUnplayed.holeNumber, screen: 'shots' };
  return { holeNumber: ordered[ordered.length - 1].holeNumber, screen: 'hole' };
}

/**
 * Hole to reopen when continuing a round: the first hole without a saved score,
 * or the last hole if every hole already has a score. Null if there are no holes.
 */
export function findResumeHoleNumber(holes: Hole[]): number | null {
  return findResumeTarget(holes)?.holeNumber ?? null;
}

export function resumePath(roundId: string, target: ResumeTarget): string {
  return target.screen === 'shots'
    ? roundShotsPath(roundId, target.holeNumber)
    : roundHolePath(roundId, target.holeNumber);
}