/**
 * Helpers for the "where I lose strokes" section. Pure and generic: they work on any
 * group that carries hole-level stats (par type, hole number, course).
 */

/** Groups with fewer played holes than this are flagged "pocos hoyos" and never ranked. */
export const LOW_SAMPLE_HOLES = 5;

export function isLowSample(holes: number): boolean {
  return holes < LOW_SAMPLE_HOLES;
}

interface HasHoleStats {
  stats: { holes: number; averageScoreToPar: number | null };
}

/**
 * The group with the highest average score to par per hole, ignoring groups with
 * fewer than `minHoles` played holes. Ties go to the first group in the given order.
 * Descriptive only: it says where strokes were above par, not why.
 */
export function highestAverageToPar<T extends HasHoleStats>(
  groups: readonly T[],
  minHoles: number = LOW_SAMPLE_HOLES,
): T | null {
  let best: T | null = null;
  let bestValue = Number.NEGATIVE_INFINITY;
  for (const group of groups) {
    const value = group.stats.averageScoreToPar;
    if (value === null || group.stats.holes < minHoles) continue;
    if (value > bestValue) {
      best = group;
      bestValue = value;
    }
  }
  return best;
}