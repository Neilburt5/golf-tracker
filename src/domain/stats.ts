import { calculateRoundStats, isPlayed, percentage } from './calculations';
import type { Hole, NumberOfHoles, Round, RoundWithHoles } from './types';

/**
 * Dashboard statistics. Pure functions over RoundWithHoles[]; no React, no IndexedDB.
 *
 * Rules (decisions D25, D18):
 * - In-progress rounds are excluded from everything.
 * - Round-level metrics use finished rounds with every hole played ("complete"),
 *   and 9-hole and 18-hole rounds are never mixed.
 * - Hole-level rates use every played hole of finished rounds, including finished
 *   rounds that still have unplayed holes (D16).
 * - Percentages are 0-100, unrounded, and null when the denominator is 0.
 * - Every figure carries its sample size.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatsFilter {
  courseId: string | null; // null = all courses
  numberOfHoles: NumberOfHoles | null; // null = both (round-level metrics need one length)
}

export const NO_FILTER: Readonly<StatsFilter> = Object.freeze({
  courseId: null,
  numberOfHoles: null,
});

/** count out of total, e.g. GIR 7 of 18. */
export interface Rate {
  count: number;
  total: number;
  percentage: number | null;
}

/** count over a number of played holes, e.g. 4 three-putts in 36 holes. */
export interface PerHole {
  count: number;
  holes: number;
  perHole: number | null;
}

/** Hole-level figures for any group of played holes. `holes` is the sample size. */
export interface HoleStats {
  holes: number;
  averageScoreToPar: number | null;
  averagePutts: number | null;
  gir: Rate;
  fairways: Rate;
  upAndDown: Rate;
  threePutts: PerHole;
  penalties: PerHole;
}

/** Hole-level figures plus how many finished rounds (with at least one played hole) they come from. */
export interface HoleLevelStats extends HoleStats {
  rounds: number;
}

export interface RoundResult {
  roundId: string;
  date: string;
  courseId: string;
  courseName: string;
  numberOfHoles: NumberOfHoles;
  totalScore: number;
  totalPar: number;
  scoreToPar: number;
  totalPutts: number;
}

export interface RoundLevelStats {
  numberOfHoles: NumberOfHoles;
  /** Sample size: complete finished rounds of this length. */
  rounds: number;
  averageScore: number | null;
  averageScoreToPar: number | null;
  averagePutts: number | null;
  /** Lowest score to par. Ties go to the earliest round. */
  best: RoundResult | null;
  /** Highest score to par. Ties go to the earliest round. */
  worst: RoundResult | null;
  /** Oldest first. This is the score-to-par series over time. */
  results: RoundResult[];
}

export interface ParBreakdown {
  par: number;
  stats: HoleStats;
}

export interface HoleNumberBreakdown {
  holeNumber: number;
  stats: HoleStats;
}

export interface CourseBreakdown {
  courseId: string;
  /** Name snapshot of the most recent round on this course. */
  courseName: string;
  rounds: number;
  stats: HoleStats;
}

export interface PuttsAverage {
  holes: number;
  totalPutts: number;
  averagePutts: number | null;
}

export interface PuttsByGir {
  withGir: PuttsAverage;
  withoutGir: PuttsAverage;
}

export interface Stats {
  filter: StatsFilter;
  /** Finished rounds left after filtering (0 means "show an empty state"). */
  finishedRounds: number;
  /** null when the filter does not select 9 or 18 holes. */
  roundLevel: RoundLevelStats | null;
  holes: HoleLevelStats;
  byPar: ParBreakdown[];
  byHoleNumber: HoleNumberBreakdown[];
  byCourse: CourseBreakdown[];
  puttsByGir: PuttsByGir;
}

// ---------------------------------------------------------------------------
// Round selection and filters
// ---------------------------------------------------------------------------

export function isFinishedRound(rw: RoundWithHoles): boolean {
  return rw.round.status === 'finished';
}

/** Finished, with exactly the expected number of holes and every one played. */
export function isCompleteRound(rw: RoundWithHoles): boolean {
  return (
    isFinishedRound(rw) &&
    rw.holes.length === rw.round.numberOfHoles &&
    rw.holes.every(isPlayed)
  );
}

/** Course and 9/18 filter. Does not look at status; the stats functions do. */
export function filterRounds(
  rounds: readonly RoundWithHoles[],
  filter: Readonly<StatsFilter>,
): RoundWithHoles[] {
  return rounds.filter(
    (rw) =>
      (filter.courseId === null || rw.round.courseId === filter.courseId) &&
      (filter.numberOfHoles === null || rw.round.numberOfHoles === filter.numberOfHoles),
  );
}

/** Finished rounds that contribute at least one played hole to hole-level figures. */
function holeLevelRounds(rounds: readonly RoundWithHoles[]): RoundWithHoles[] {
  return rounds.filter(isFinishedRound).filter((rw) => rw.holes.some(isPlayed));
}

function playedHolesOf(rounds: readonly RoundWithHoles[]): Hole[] {
  return holeLevelRounds(rounds).flatMap((rw) => rw.holes.filter(isPlayed));
}

// ---------------------------------------------------------------------------
// Hole-level figures
// ---------------------------------------------------------------------------

/** Figures for a group of holes. Unplayed holes are ignored. */
export function calculateHoleStats(holes: readonly Hole[]): HoleStats {
  const s = calculateRoundStats(holes);
  const n = s.holesPlayed;
  return {
    holes: n,
    averageScoreToPar: average(s.scoreToPar, n),
    averagePutts: average(s.totalPutts, n),
    gir: rate(s.girCount, n),
    fairways: rate(s.fairwaysHit, s.fairwayOpportunities),
    upAndDown: rate(s.upAndDownMade, s.upAndDownAttempts),
    threePutts: perHole(s.threePutts, n),
    penalties: perHole(s.penaltyStrokes, n),
  };
}

/** All played holes of all finished rounds given. */
export function calculateHoleLevelStats(rounds: readonly RoundWithHoles[]): HoleLevelStats {
  return {
    rounds: holeLevelRounds(rounds).length,
    ...calculateHoleStats(playedHolesOf(rounds)),
  };
}

/** One group per par value present, ascending. */
export function breakdownByPar(rounds: readonly RoundWithHoles[]): ParBreakdown[] {
  return Array.from(groupBy(playedHolesOf(rounds), (h) => h.par))
    .sort(([a], [b]) => a - b)
    .map(([par, holes]) => ({ par, stats: calculateHoleStats(holes) }));
}

/** One group per real course hole number present (1-18), ascending. */
export function breakdownByHoleNumber(rounds: readonly RoundWithHoles[]): HoleNumberBreakdown[] {
  return Array.from(groupBy(playedHolesOf(rounds), (h) => h.holeNumber))
    .sort(([a], [b]) => a - b)
    .map(([holeNumber, holes]) => ({ holeNumber, stats: calculateHoleStats(holes) }));
}

/** One group per course id, sorted by course name. */
export function breakdownByCourse(rounds: readonly RoundWithHoles[]): CourseBreakdown[] {
  const groups = groupBy(holeLevelRounds(rounds), (rw) => rw.round.courseId);
  return Array.from(groups)
    .map(([courseId, courseRounds]) => {
      const newest = [...courseRounds].sort((a, b) => compareChronological(a.round, b.round));
      const latest = newest[newest.length - 1];
      return {
        courseId,
        courseName: latest ? latest.round.courseName : courseId,
        rounds: courseRounds.length,
        stats: calculateHoleStats(courseRounds.flatMap((rw) => rw.holes)),
      };
    })
    .sort((a, b) => a.courseName.localeCompare(b.courseName) || a.courseId.localeCompare(b.courseId));
}
/** A course that appears in the filter select. */
export interface CourseOption {
  courseId: string;
  /** Name snapshot of the most recent finished round on this course. */
  courseName: string;
  /** Finished rounds on this course (9 and 18 holes together). */
  rounds: number;
}

/** Distinct courses of finished rounds, sorted by name, for the course filter. */
export function listCourseOptions(rounds: readonly RoundWithHoles[]): CourseOption[] {
  const groups = groupBy(rounds.filter(isFinishedRound), (rw) => rw.round.courseId);
  return Array.from(groups)
    .map(([courseId, courseRounds]) => {
      const latest = courseRounds.reduce((a, b) =>
        compareChronological(b.round, a.round) > 0 ? b : a,
      );
      return { courseId, courseName: latest.round.courseName, rounds: courseRounds.length };
    })
    .sort((a, b) => a.courseName.localeCompare(b.courseName) || a.courseId.localeCompare(b.courseId));
}

export function puttsByGir(rounds: readonly RoundWithHoles[]): PuttsByGir {
  const played = playedHolesOf(rounds);
  return {
    withGir: puttsAverage(played.filter((h) => h.gir)),
    withoutGir: puttsAverage(played.filter((h) => !h.gir)),
  };
}

// ---------------------------------------------------------------------------
// Round-level figures
// ---------------------------------------------------------------------------

/**
 * Complete finished rounds of ONE length (9 and 18 are never mixed).
 * `results` is the score-to-par series over time, oldest first.
 */
export function calculateRoundLevelStats(
  rounds: readonly RoundWithHoles[],
  numberOfHoles: NumberOfHoles,
): RoundLevelStats {
  const results = rounds
    .filter((rw) => isCompleteRound(rw) && rw.round.numberOfHoles === numberOfHoles)
    .sort((a, b) => compareChronological(a.round, b.round))
    .map(toRoundResult);

  let best: RoundResult | null = null;
  let worst: RoundResult | null = null;
  for (const result of results) {
    if (best === null || result.scoreToPar < best.scoreToPar) best = result;
    if (worst === null || result.scoreToPar > worst.scoreToPar) worst = result;
  }

  const n = results.length;
  return {
    numberOfHoles,
    rounds: n,
    averageScore: average(sum(results.map((r) => r.totalScore)), n),
    averageScoreToPar: average(sum(results.map((r) => r.scoreToPar)), n),
    averagePutts: average(sum(results.map((r) => r.totalPutts)), n),
    best,
    worst,
    results,
  };
}

function toRoundResult(rw: RoundWithHoles): RoundResult {
  const s = calculateRoundStats(rw.holes);
  return {
    roundId: rw.round.id,
    date: rw.round.date,
    courseId: rw.round.courseId,
    courseName: rw.round.courseName,
    numberOfHoles: rw.round.numberOfHoles,
    totalScore: s.totalScore,
    totalPar: s.totalPar,
    scoreToPar: s.scoreToPar,
    totalPutts: s.totalPutts,
  };
}

// ---------------------------------------------------------------------------
// Everything for the dashboard
// ---------------------------------------------------------------------------

export function calculateStats(
  allRounds: readonly RoundWithHoles[],
  filter: Readonly<StatsFilter> = NO_FILTER,
): Stats {
  const rounds = filterRounds(allRounds, filter);
  return {
    filter: { courseId: filter.courseId, numberOfHoles: filter.numberOfHoles },
    finishedRounds: rounds.filter(isFinishedRound).length,
    roundLevel:
      filter.numberOfHoles === null
        ? null
        : calculateRoundLevelStats(rounds, filter.numberOfHoles),
    holes: calculateHoleLevelStats(rounds),
    byPar: breakdownByPar(rounds),
    byHoleNumber: breakdownByHoleNumber(rounds),
    byCourse: breakdownByCourse(rounds),
    puttsByGir: puttsByGir(rounds),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sum(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/** total / count, or null when count is 0. */
function average(total: number, count: number): number | null {
  return count === 0 ? null : total / count;
}

function rate(count: number, total: number): Rate {
  return { count, total, percentage: percentage(count, total) };
}

function perHole(count: number, holes: number): PerHole {
  return { count, holes, perHole: average(count, holes) };
}

function puttsAverage(holes: readonly Hole[]): PuttsAverage {
  const totalPutts = sum(holes.map((h) => h.putts));
  return { holes: holes.length, totalPutts, averagePutts: average(totalPutts, holes.length) };
}

function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Oldest first: date, then createdAt, then id (same order as the export). */
function compareChronological(a: Round, b: Round): number {
  return (
    compareStrings(a.date, b.date) ||
    compareStrings(a.createdAt, b.createdAt) ||
    compareStrings(a.id, b.id)
  );
}