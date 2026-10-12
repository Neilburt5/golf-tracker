import { describe, expect, it } from 'vitest';
import {
  NO_FILTER,
  breakdownByCourse,
  breakdownByHoleNumber,
  breakdownByPar,
  calculateHoleLevelStats,
  calculateRoundLevelStats,
  calculateStats,
  filterRounds,
  isCompleteRound,
  puttsByGir,
} from '../src/domain/stats';
import type {
  Hole,
  NumberOfHoles,
  RoundStatus,
  RoundWithHoles,
  StartHole,
} from '../src/domain/types';

// ---------------------------------------------------------------------------
// Local helpers. Defaults: every hole par 4, score 5, 2 putts, no extras.
// ---------------------------------------------------------------------------

interface RoundOptions {
  id: string;
  status?: RoundStatus;
  numberOfHoles?: NumberOfHoles;
  startHole?: StartHole;
  courseId?: string;
  courseName?: string;
  date?: string;
}

type HoleOverrides = (index: number) => Partial<Hole>;

function buildRound(opts: RoundOptions, overrides: HoleOverrides = () => ({})): RoundWithHoles {
  const numberOfHoles = opts.numberOfHoles ?? 18;
  const startHole = opts.startHole ?? 1;
  const date = opts.date ?? '2026-03-01';
  const holes: Hole[] = Array.from({ length: numberOfHoles }, (_, i) => ({
    id: `${opts.id}-h${startHole + i}`,
    roundId: opts.id,
    holeNumber: startHole + i,
    par: 4,
    score: 5,
    putts: 2,
    fairway: false,
    gir: false,
    penaltyStrokes: 0,
    bunker: false,
    upAndDown: null,
    ...overrides(i),
  }));
  return {
    round: {
      id: opts.id,
      courseId: opts.courseId ?? 'c1',
      courseName: opts.courseName ?? 'Course One',
      date,
      tee: 'Amarillas',
      numberOfHoles,
      startHole,
      status: opts.status ?? 'finished',
      createdAt: `${date}T08:00:00.000Z`,
      updatedAt: `${date}T12:00:00.000Z`,
    },
    holes,
  };
}

/** Holes at the given positions get these overrides; the rest keep the defaults. */
function bySpec(specs: Partial<Hole>[], fallback: Partial<Hole> = { score: null }): HoleOverrides {
  return (i) => specs[i] ?? fallback;
}

// ---------------------------------------------------------------------------

describe('isCompleteRound', () => {
  it('requires finished status, the expected hole count and every hole played', () => {
    expect(isCompleteRound(buildRound({ id: 'a' }))).toBe(true);
    expect(isCompleteRound(buildRound({ id: 'b', status: 'in_progress' }))).toBe(false);
    expect(
      isCompleteRound(buildRound({ id: 'c' }, (i) => (i === 17 ? { score: null } : {}))),
    ).toBe(false);

    const missingHole = buildRound({ id: 'd' });
    missingHole.holes.pop();
    expect(isCompleteRound(missingHole)).toBe(false);
  });
});

describe('filterRounds', () => {
  const a = buildRound({ id: 'a', courseId: 'c1', numberOfHoles: 18 });
  const b = buildRound({ id: 'b', courseId: 'c1', numberOfHoles: 9 });
  const c = buildRound({ id: 'c', courseId: 'c2', numberOfHoles: 18 });
  const d = buildRound({ id: 'd', courseId: 'c2', numberOfHoles: 9 });
  const all = [a, b, c, d];
  const ids = (rounds: RoundWithHoles[]) => rounds.map((rw) => rw.round.id);

  it('returns everything without a filter', () => {
    expect(ids(filterRounds(all, NO_FILTER))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('filters by course', () => {
    expect(ids(filterRounds(all, { courseId: 'c2', numberOfHoles: null }))).toEqual(['c', 'd']);
  });

  it('filters by 9 or 18 holes', () => {
    expect(ids(filterRounds(all, { courseId: null, numberOfHoles: 9 }))).toEqual(['b', 'd']);
    expect(ids(filterRounds(all, { courseId: null, numberOfHoles: 18 }))).toEqual(['a', 'c']);
  });

  it('combines both filters and does not touch the input', () => {
    expect(ids(filterRounds(all, { courseId: 'c1', numberOfHoles: 9 }))).toEqual(['b']);
    expect(ids(all.slice())).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(filterRounds(all, { courseId: 'nope', numberOfHoles: null }))).toEqual([]);
  });
});

describe('in-progress rounds', () => {
  it('are excluded from every figure', () => {
    const inProgress = buildRound({ id: 'ip', status: 'in_progress' });
    const stats = calculateStats([inProgress], { courseId: null, numberOfHoles: 18 });

    expect(stats.finishedRounds).toBe(0);
    expect(stats.roundLevel?.rounds).toBe(0);
    expect(stats.holes.rounds).toBe(0);
    expect(stats.holes.holes).toBe(0);
    expect(stats.byPar).toEqual([]);
    expect(stats.byHoleNumber).toEqual([]);
    expect(stats.byCourse).toEqual([]);
    expect(stats.puttsByGir.withGir.holes + stats.puttsByGir.withoutGir.holes).toBe(0);
  });

  it('do not change the figures of finished rounds around them', () => {
    const finished = buildRound({ id: 'f' });
    const inProgress = buildRound({ id: 'ip', status: 'in_progress' }, () => ({ score: 9 }));
    expect(calculateStats([finished, inProgress])).toEqual(calculateStats([finished]));
  });
});

describe('incomplete finished rounds', () => {
  const complete = buildRound({ id: 'full', date: '2026-03-01' });
  const incomplete = buildRound({ id: 'partial', date: '2026-03-08' }, (i) =>
    i === 17 ? { score: null } : {},
  );

  it('are left out of round-level figures', () => {
    const level = calculateRoundLevelStats([complete, incomplete], 18);
    expect(level.rounds).toBe(1);
    expect(level.results.map((r) => r.roundId)).toEqual(['full']);
  });

  it('still count in hole-level figures, with their real sample size', () => {
    const level = calculateHoleLevelStats([complete, incomplete]);
    expect(level.rounds).toBe(2);
    expect(level.holes).toBe(35);
  });

  it('a finished round with no played hole contributes nothing', () => {
    const empty = buildRound({ id: 'empty' }, () => ({ score: null }));
    const level = calculateHoleLevelStats([empty]);
    expect(level.rounds).toBe(0);
    expect(level.holes).toBe(0);
  });
});

describe('9-hole and 18-hole rounds are never mixed', () => {
  const eighteen = buildRound({ id: 'r18', numberOfHoles: 18 }); // 90, +18
  const nine = buildRound({ id: 'r9', numberOfHoles: 9 }); // 45, +9
  const rounds = [eighteen, nine];

  it('round-level figures use only the selected length', () => {
    const l18 = calculateRoundLevelStats(rounds, 18);
    expect(l18.rounds).toBe(1);
    expect(l18.averageScore).toBe(90);
    expect(l18.averageScoreToPar).toBe(18);

    const l9 = calculateRoundLevelStats(rounds, 9);
    expect(l9.rounds).toBe(1);
    expect(l9.averageScore).toBe(45);
    expect(l9.averageScoreToPar).toBe(9);
  });

  it('calculateStats gives no round-level block until a length is chosen', () => {
    expect(calculateStats(rounds).roundLevel).toBeNull();
    expect(calculateStats(rounds, { courseId: null, numberOfHoles: 9 }).roundLevel?.averageScore).toBe(45);
  });

  it('hole-level figures combine both lengths when no length is chosen', () => {
    expect(calculateStats(rounds).holes.holes).toBe(27);
    expect(calculateStats(rounds, { courseId: null, numberOfHoles: 9 }).holes.holes).toBe(9);
  });
});

describe('round-level figures', () => {
  // Input deliberately out of date order.
  const r1 = buildRound({ id: 'r1', date: '2026-03-08' }, () => ({ score: 5 })); // 90, +18
  const r2 = buildRound({ id: 'r2', date: '2026-03-01' }, () => ({ score: 4 })); // 72, 0
  const r3 = buildRound({ id: 'r3', date: '2026-03-15' }, () => ({ score: 6 })); // 108, +36
  const level = calculateRoundLevelStats([r1, r2, r3], 18);

  it('averages score, score to par and putts', () => {
    expect(level.rounds).toBe(3);
    expect(level.averageScore).toBe(90);
    expect(level.averageScoreToPar).toBe(18);
    expect(level.averagePutts).toBe(36);
  });

  it('returns the series oldest first', () => {
    expect(level.results.map((r) => r.roundId)).toEqual(['r2', 'r1', 'r3']);
    expect(level.results.map((r) => r.scoreToPar)).toEqual([0, 18, 36]);
  });

  it('picks best and worst by score to par', () => {
    expect(level.best?.roundId).toBe('r2');
    expect(level.best?.totalScore).toBe(72);
    expect(level.worst?.roundId).toBe('r3');
    expect(level.worst?.totalScore).toBe(108);
  });

  it('breaks ties in favour of the earliest round', () => {
    const early = buildRound({ id: 'early', date: '2026-03-01' });
    const late = buildRound({ id: 'late', date: '2026-03-02' });
    const tied = calculateRoundLevelStats([late, early], 18);
    expect(tied.best?.roundId).toBe('early');
    expect(tied.worst?.roundId).toBe('early');
  });

  it('compares across courses by score to par, not by raw score', () => {
    const par3Course = buildRound({ id: 'p3', courseId: 'c2' }, () => ({ par: 3, score: 4 })); // 72, +18
    const par4Course = buildRound({ id: 'p4', courseId: 'c1' }, () => ({ par: 4, score: 4 })); // 72, 0
    const mixed = calculateRoundLevelStats([par3Course, par4Course], 18);
    expect(mixed.best?.roundId).toBe('p4');
    expect(mixed.worst?.roundId).toBe('p3');
  });
});

describe('empty data', () => {
  it('has null averages and percentages, never NaN', () => {
    const stats = calculateStats([]);
    expect(stats.finishedRounds).toBe(0);
    expect(stats.roundLevel).toBeNull();
    expect(stats.holes.rounds).toBe(0);
    expect(stats.holes.holes).toBe(0);
    expect(stats.holes.averageScoreToPar).toBeNull();
    expect(stats.holes.averagePutts).toBeNull();
    expect(stats.holes.gir).toEqual({ count: 0, total: 0, percentage: null });
    expect(stats.holes.fairways.percentage).toBeNull();
    expect(stats.holes.upAndDown.percentage).toBeNull();
    expect(stats.holes.threePutts.perHole).toBeNull();
    expect(stats.holes.penalties.perHole).toBeNull();
    expect(stats.byPar).toEqual([]);
    expect(stats.byHoleNumber).toEqual([]);
    expect(stats.byCourse).toEqual([]);
    expect(stats.puttsByGir.withGir.averagePutts).toBeNull();
    expect(stats.puttsByGir.withoutGir.averagePutts).toBeNull();
  });

  it('gives an empty round-level block when a length is chosen', () => {
    const level = calculateStats([], { courseId: null, numberOfHoles: 18 }).roundLevel;
    expect(level).not.toBeNull();
    expect(level?.rounds).toBe(0);
    expect(level?.averageScore).toBeNull();
    expect(level?.averageScoreToPar).toBeNull();
    expect(level?.averagePutts).toBeNull();
    expect(level?.best).toBeNull();
    expect(level?.worst).toBeNull();
    expect(level?.results).toEqual([]);
  });
});

describe('hole-level rates', () => {
  // Only 3 holes played; the other 6 are unplayed.
  const round = buildRound(
    { id: 'r', numberOfHoles: 9 },
    bySpec([
      { score: 4, putts: 2, fairway: true, gir: true },
      { par: 3, score: 4, putts: 3, fairway: null, gir: false, upAndDown: true, penaltyStrokes: 1 },
      { score: 5, putts: 1, fairway: false, gir: false, upAndDown: false },
    ]),
  );
  const level = calculateHoleLevelStats([round]);

  it('uses played holes only as the sample', () => {
    expect(level.rounds).toBe(1);
    expect(level.holes).toBe(3);
  });

  it('computes GIR with its sample size, unrounded', () => {
    expect(level.gir.count).toBe(1);
    expect(level.gir.total).toBe(3);
    expect(level.gir.percentage).toBeCloseTo(33.3333, 3);
  });

  it('counts fairways against applicable holes only (par 3 excluded)', () => {
    expect(level.fairways).toEqual({ count: 1, total: 2, percentage: 50 });
  });

  it('counts up & downs against real opportunities only', () => {
    expect(level.upAndDown).toEqual({ count: 1, total: 2, percentage: 50 });
  });

  it('computes 3-putts and penalties per hole', () => {
    expect(level.threePutts.count).toBe(1);
    expect(level.threePutts.holes).toBe(3);
    expect(level.threePutts.perHole).toBeCloseTo(1 / 3);
    expect(level.penalties.count).toBe(1);
    expect(level.penalties.perHole).toBeCloseTo(1 / 3);
  });

  it('computes average score to par and putts per hole', () => {
    expect(level.averageScoreToPar).toBeCloseTo(2 / 3); // 0, +1, +1
    expect(level.averagePutts).toBe(2); // (2 + 3 + 1) / 3
  });

  it('returns null, not 0 or NaN, when there is nothing to divide by', () => {
    const allPar3 = buildRound({ id: 'p3', numberOfHoles: 9 }, () => ({ par: 3, fairway: null }));
    const stats = calculateHoleLevelStats([allPar3]);
    expect(stats.fairways).toEqual({ count: 0, total: 0, percentage: null });
    expect(stats.upAndDown).toEqual({ count: 0, total: 0, percentage: null });
    expect(stats.gir.percentage).toBe(0); // 9 holes played, none with GIR: a real 0
  });

  it('includes unplayed-hole rounds only through their played holes', () => {
    const full = buildRound({ id: 'full', numberOfHoles: 9 });
    const combined = calculateHoleLevelStats([round, full]);
    expect(combined.rounds).toBe(2);
    expect(combined.holes).toBe(12);
  });
});

describe('breakdowns', () => {
  it('by par: one group per par value, ascending, with sample sizes', () => {
    const round = buildRound({ id: 'r', numberOfHoles: 9 }, (i) => {
      const par = i < 3 ? 3 : i < 6 ? 4 : 5;
      return { par, score: par + 1 };
    });
    // Order of input must not matter for the output order.
    const groups = breakdownByPar([round]);
    expect(groups.map((g) => g.par)).toEqual([3, 4, 5]);
    expect(groups.map((g) => g.stats.holes)).toEqual([3, 3, 3]);
    expect(groups.map((g) => g.stats.averageScoreToPar)).toEqual([1, 1, 1]);
  });

  it('by hole number: uses real numbers and sorts numerically', () => {
    const front = buildRound({ id: 'f', numberOfHoles: 9, startHole: 1 });
    const back = buildRound({ id: 'b', numberOfHoles: 9, startHole: 10 });
    const groups = breakdownByHoleNumber([back, front]);
    expect(groups.map((g) => g.holeNumber)).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
    expect(groups.every((g) => g.stats.holes === 1)).toBe(true);
  });

  it('by hole number: the same hole in several rounds adds up', () => {
    const a = buildRound({ id: 'a', numberOfHoles: 9 }, () => ({ score: 4 }));
    const b = buildRound({ id: 'b', numberOfHoles: 9 }, () => ({ score: 6 }));
    const hole1 = breakdownByHoleNumber([a, b]).find((g) => g.holeNumber === 1);
    expect(hole1?.stats.holes).toBe(2);
    expect(hole1?.stats.averageScoreToPar).toBe(1); // (0 + 2) / 2
  });

  it('by course: groups by course id, names from the latest round, sorted by name', () => {
    const old = buildRound({ id: 'o1', courseId: 'c1', courseName: 'Old name', date: '2026-03-01', numberOfHoles: 9 });
    const renamed = buildRound({ id: 'o2', courseId: 'c1', courseName: 'New name', date: '2026-03-10', numberOfHoles: 9 });
    const other = buildRound({ id: 'x', courseId: 'c2', courseName: 'Alpha', date: '2026-03-05', numberOfHoles: 9 });

    const groups = breakdownByCourse([renamed, other, old]);
    expect(groups.map((g) => [g.courseId, g.courseName, g.rounds, g.stats.holes])).toEqual([
      ['c2', 'Alpha', 1, 9],
      ['c1', 'New name', 2, 18],
    ]);
  });

  it('by course: unplayed holes are not counted in the sample', () => {
    const partial = buildRound({ id: 'p', numberOfHoles: 9 }, bySpec([{ score: 4 }, { score: 5 }]));
    const groups = breakdownByCourse([partial]);
    expect(groups.map((g) => g.stats.holes)).toEqual([2]);
  });

  it('putts with and without GIR', () => {
    const round = buildRound({ id: 'r', numberOfHoles: 9 }, (i) =>
      i < 3 ? { gir: true, putts: [1, 2, 1][i] ?? 0 } : { gir: false, putts: 2 },
    );
    const result = puttsByGir([round]);
    expect(result.withGir).toEqual({ holes: 3, totalPutts: 4, averagePutts: 4 / 3 });
    expect(result.withoutGir).toEqual({ holes: 6, totalPutts: 12, averagePutts: 2 });
  });

  it('putts by GIR: one side can be empty', () => {
    const noGir = buildRound({ id: 'n', numberOfHoles: 9 });
    const result = puttsByGir([noGir]);
    expect(result.withGir).toEqual({ holes: 0, totalPutts: 0, averagePutts: null });
    expect(result.withoutGir.holes).toBe(9);
  });
});

describe('calculateStats', () => {
  const a = buildRound({ id: 'a', courseId: 'c1', numberOfHoles: 18 });
  const b = buildRound({ id: 'b', courseId: 'c1', numberOfHoles: 9 });
  const c = buildRound({ id: 'c', courseId: 'c2', numberOfHoles: 9 });
  const rounds = [a, b, c];

  it('applies the course and 9/18 filters to every block', () => {
    const filter = { courseId: 'c1', numberOfHoles: 9 as const };
    const stats = calculateStats(rounds, filter);

    expect(stats.filter).toEqual(filter);
    expect(stats.finishedRounds).toBe(1);
    expect(stats.roundLevel?.numberOfHoles).toBe(9);
    expect(stats.roundLevel?.rounds).toBe(1);
    expect(stats.holes.holes).toBe(9);
    expect(stats.byCourse.map((g) => g.courseId)).toEqual(['c1']);
    expect(stats.byHoleNumber).toHaveLength(9);
  });

  it('counts finished rounds only in finishedRounds', () => {
    const inProgress = buildRound({ id: 'ip', status: 'in_progress' });
    expect(calculateStats([...rounds, inProgress]).finishedRounds).toBe(3);
  });

  it('does not mutate its input', () => {
    const before = JSON.stringify(rounds);
    calculateStats(rounds, { courseId: null, numberOfHoles: 18 });
    expect(JSON.stringify(rounds)).toBe(before);
  });
});