import type { Hole } from './types';

/**
 * Hole to reopen when continuing a round: the first hole without a saved score,
 * or the last hole if every hole already has a score. Null if there are no holes.
 */
export function findResumeHoleNumber(holes: Hole[]): number | null {
  if (holes.length === 0) return null;
  const ordered = [...holes].sort((a, b) => a.holeNumber - b.holeNumber);
  const firstUnplayed = ordered.find((hole) => hole.score === null);
  return (firstUnplayed ?? ordered[ordered.length - 1]).holeNumber;
}
