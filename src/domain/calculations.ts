import type { Hole, RoundStats } from './types';

type PlayedHole = Hole & { score: number };

/** A hole counts as played once it has a saved score. */
export function isPlayed(hole: Hole): hole is PlayedHole {
  return hole.score !== null;
}

/** Suggested GIR: reached the green in (par - 2) strokes or fewer. */
export function suggestGir(score: number, putts: number, par: number): boolean {
  return score - putts <= par - 2;
}

export function isThreePutt(hole: Pick<Hole, 'putts'>): boolean {
  return hole.putts >= 3;
}

/** Score relative to par for one hole, or null if the hole has no score yet. */
export function holeScoreToPar(hole: Hole): number | null {
  return isPlayed(hole) ? hole.score - hole.par : null;
}

/** Real course hole numbers for a round, e.g. startHole 10, 9 holes -> [10..18]. */
export function holeNumbersFor(startHole: number, numberOfHoles: number): number[] {
  return Array.from({ length: numberOfHoles }, (_, i) => startHole + i);
}

/** part / total as 0-100, or null when total is 0. */
export function percentage(part: number, total: number): number | null {
  return total === 0 ? null : (part / total) * 100;
}

export function calculateRoundStats(holes: readonly Hole[]): RoundStats {
  const played = holes.filter(isPlayed);

  const totalScore = sum(played.map((h) => h.score));
  const totalPar = sum(played.map((h) => h.par));

  const fairwayHoles = played.filter((h) => h.fairway !== null);
  const upAndDownHoles = played.filter((h) => h.upAndDown !== null);

  const girCount = played.filter((h) => h.gir).length;
  const upAndDownMade = upAndDownHoles.filter((h) => h.upAndDown === true).length;

  return {
    holesPlayed: played.length,
    totalScore,
    totalPar,
    scoreToPar: totalScore - totalPar,
    totalPutts: sum(played.map((h) => h.putts)),
    fairwaysHit: fairwayHoles.filter((h) => h.fairway === true).length,
    fairwayOpportunities: fairwayHoles.length,
    girCount,
    girPercentage: percentage(girCount, played.length),
    penaltyStrokes: sum(played.map((h) => h.penaltyStrokes)),
    bunkers: played.filter((h) => h.bunker).length,
    upAndDownAttempts: upAndDownHoles.length,
    upAndDownMade,
    upAndDownPercentage: percentage(upAndDownMade, upAndDownHoles.length),
    threePutts: played.filter(isThreePutt).length,
  };
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}