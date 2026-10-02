import { db as defaultDb, type GolfDatabase } from './db';
import type { Course, Hole, Round, RoundWithHoles } from '../domain/types';

export interface NewRoundInput {
  course: Course;
  tee: string;
  numberOfHoles: 9 | 18;
  startHole: 1 | 10;
  /** ISO date. Defaults to now. */
  date?: string;
}

/** Result of importing one round from a backup. */
export type ImportResult = 'imported' | 'skipped';

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

  /**
   * Every round with its holes (ordered by hole number), newest round first.
   * Read in a single transaction so the list is consistent.
   * Used by the rounds list and by the JSON backup.
   */
  async function listRoundsWithHoles(): Promise<RoundWithHoles[]> {
    return database.transaction('r', database.rounds, database.holes, async () => {
      const rounds = await database.rounds.toArray();
      const allHoles = await database.holes.toArray();

      const holesByRound = new Map<string, Hole[]>();
      for (const hole of allHoles) {
        const list = holesByRound.get(hole.roundId);
        if (list) list.push(hole);
        else holesByRound.set(hole.roundId, [hole]);
      }

      return rounds
        .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
        .map((round) => ({
          round,
          holes: (holesByRound.get(round.id) ?? []).sort((a, b) => a.holeNumber - b.holeNumber),
        }));
    });
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

  /**
   * Permanently deletes a round and all of its holes in one transaction.
   * Idempotent: deleting an unknown id does nothing.
   * The UI must ask for confirmation before calling this.
   */
  async function deleteRound(roundId: string): Promise<void> {
    await database.transaction('rw', database.rounds, database.holes, async () => {
      await database.holes.where('roundId').equals(roundId).delete();
      await database.rounds.delete(roundId);
    });
  }

  /**
   * Inserts a round from a backup. NEVER overwrites: if a round with the same id
   * already exists, nothing is written and 'skipped' is returned.
   * Round and holes are written in one transaction, so a failure leaves nothing behind.
   * Structural validation of the backup file happens in services/backup.ts;
   * here we only guard the relation between the round and its holes.
   */
  async function importRound(data: RoundWithHoles): Promise<ImportResult> {
    const { round, holes } = data;

    if (holes.some((h) => h.roundId !== round.id)) {
      throw new Error(`Round ${round.id} contains holes that belong to another round`);
    }

    return database.transaction('rw', database.rounds, database.holes, async () => {
      if (await database.rounds.get(round.id)) {
        return 'skipped' as const;
      }
      await database.rounds.add(round);
      await database.holes.bulkAdd(holes);
      return 'imported' as const;
    });
  }

  return {
    createRound,
    getRound,
    getHoles,
    getInProgressRound,
    listRoundsWithHoles,
    saveHole,
    finishRound,
    deleteRound,
    importRound,
  };
}

export type RoundRepository = ReturnType<typeof createRoundRepository>;

export const roundRepository = createRoundRepository(defaultDb);