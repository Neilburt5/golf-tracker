import { db as defaultDb, type GolfDatabase } from './db';
import type { Course, Hole, Round } from '../domain/types';

export interface NewRoundInput {
  course: Course;
  tee: string;
  numberOfHoles: 9 | 18;
  startHole: 1 | 10;
  /** ISO date. Defaults to now. */
  date?: string;
}

type Clock = () => string;

const isoNow: Clock = () => new Date().toISOString();

function buildHoles(
  roundId: string,
  course: Course,
  startHole: number,
  numberOfHoles: number,
): Hole[] {
  const holes: Hole[] = [];
  for (let holeNumber = startHole; holeNumber < startHole + numberOfHoles; holeNumber++) {
    const courseHole = course.holes.find((h) => h.number === holeNumber);
    if (!courseHole) {
      throw new Error(
        `Course "${course.name}" has no hole ${holeNumber} ` +
          `(startHole=${startHole}, numberOfHoles=${numberOfHoles})`,
      );
    }
    holes.push({
      id: crypto.randomUUID(),
      roundId,
      holeNumber,
      par: courseHole.par,
      score: null,
      putts: 0,
      fairway: courseHole.par === 3 ? null : false,
      gir: false,
      penaltyStrokes: 0,
      bunker: false,
      upAndDown: null,
    });
  }
  return holes;
}

export function createRoundRepository(database: GolfDatabase, now: Clock = isoNow) {
  async function createRound(input: NewRoundInput): Promise<Round> {
    const { course, tee, numberOfHoles, startHole } = input;

    if (!course.tees.includes(tee)) {
      throw new Error(`Unknown tee "${tee}" for course "${course.name}"`);
    }

    const timestamp = now();
    const round: Round = {
      id: crypto.randomUUID(),
      courseId: course.id,
      courseName: course.name, // snapshot
      date: input.date ?? timestamp,
      tee,
      numberOfHoles,
      startHole,
      status: 'in_progress',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Throws before touching the database if the hole range doesn't fit the course.
    const holes = buildHoles(round.id, course, startHole, numberOfHoles);

    await database.transaction('rw', database.rounds, database.holes, async () => {
      await database.rounds.add(round);
      await database.holes.bulkAdd(holes);
    });

    return round;
  }

  async function getRound(roundId: string): Promise<Round | undefined> {
    return database.rounds.get(roundId);
  }

  /** Holes of a round, ordered by hole number. */
  async function getHoles(roundId: string): Promise<Hole[]> {
    const holes = await database.holes.where('roundId').equals(roundId).toArray();
    return holes.sort((a, b) => a.holeNumber - b.holeNumber);
  }

  /** Most recently updated round that is still in progress, if any. */
  async function getInProgressRound(): Promise<Round | undefined> {
    const rounds = await database.rounds.where('status').equals('in_progress').sortBy('updatedAt');
    return rounds[rounds.length - 1];
  }

  /** Overwrites an existing hole row (autosave and "Save & next" both use this). */
  async function saveHole(hole: Hole): Promise<void> {
    await database.transaction('rw', database.rounds, database.holes, async () => {
      const existing = await database.holes.get(hole.id);
      if (!existing) {
        throw new Error(`Hole ${hole.id} does not exist`);
      }
      if (existing.roundId !== hole.roundId || existing.holeNumber !== hole.holeNumber) {
        throw new Error('A hole cannot be moved to another round or hole number');
      }
      await database.holes.put(hole);
      await database.rounds.update(hole.roundId, { updatedAt: now() });
    });
  }

  async function finishRound(roundId: string): Promise<Round> {
    return database.transaction('rw', database.rounds, async () => {
      const round = await database.rounds.get(roundId);
      if (!round) {
        throw new Error(`Round ${roundId} does not exist`);
      }
      if (round.status === 'finished') {
        return round;
      }
      const finished: Round = { ...round, status: 'finished', updatedAt: now() };
      await database.rounds.put(finished);
      return finished;
    });
  }

  return { createRound, getRound, getHoles, getInProgressRound, saveHole, finishRound };
}

export type RoundRepository = ReturnType<typeof createRoundRepository>;

export const roundRepository = createRoundRepository(defaultDb);