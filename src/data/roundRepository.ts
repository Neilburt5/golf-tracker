import { db as defaultDb, type GolfDatabase } from './db';
import { validateShot } from '../domain/shots';
import type {
  Course,
  Hole,
  Round,
  RoundWeather,
  RoundWithHoles,
  Shot,
  ShotInput,
} from '../domain/types';

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

function sortShots(shots: Shot[]): Shot[] {
  return shots.sort((a, b) => a.holeNumber - b.holeNumber || a.sequence - b.sequence);
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
   * Every round with its holes (ordered by hole number), weather and shots when known,
   * newest round first. Read in a single transaction so the list is consistent.
   * Used by the rounds list and by the JSON backup.
   */
  async function listRoundsWithHoles(): Promise<RoundWithHoles[]> {
    return database.transaction(
      'r',
      database.rounds,
      database.holes,
      database.weather,
      database.shots,
      async () => {
        const rounds = await database.rounds.toArray();
        const allHoles = await database.holes.toArray();
        const allWeather = await database.weather.toArray();
        const allShots = await database.shots.toArray();

        const holesByRound = new Map<string, Hole[]>();
        for (const hole of allHoles) {
          const list = holesByRound.get(hole.roundId);
          if (list) list.push(hole);
          else holesByRound.set(hole.roundId, [hole]);
        }

        const weatherByRound = new Map<string, RoundWeather>();
        for (const weather of allWeather) weatherByRound.set(weather.roundId, weather);

        const shotsByRound = new Map<string, Shot[]>();
        for (const shot of allShots) {
          const list = shotsByRound.get(shot.roundId);
          if (list) list.push(shot);
          else shotsByRound.set(shot.roundId, [shot]);
        }

        return rounds
          .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
          .map((round): RoundWithHoles => {
            const data: RoundWithHoles = {
              round,
              holes: (holesByRound.get(round.id) ?? []).sort((a, b) => a.holeNumber - b.holeNumber),
            };
            const weather = weatherByRound.get(round.id);
            if (weather) data.weather = weather;
            const shots = shotsByRound.get(round.id);
            if (shots && shots.length > 0) data.shots = sortShots(shots);
            return data;
          });
      },
    );
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
   * Permanently deletes a round, its holes, its weather and its shots in one transaction.
   * Idempotent: deleting an unknown id does nothing.
   * The UI must ask for confirmation before calling this.
   */
  async function deleteRound(roundId: string): Promise<void> {
    await database.transaction(
      'rw',
      database.rounds,
      database.holes,
      database.weather,
      database.shots,
      async () => {
        await database.holes.where('roundId').equals(roundId).delete();
        await database.shots.where('roundId').equals(roundId).delete();
        await database.weather.delete(roundId);
        await database.rounds.delete(roundId);
      },
    );
  }

  /**
   * Inserts a round from a backup. NEVER overwrites: if a round with the same id
   * already exists, nothing is written and 'skipped' is returned (weather and shots included).
   * Round, holes, weather and shots are written in one transaction, so a failure leaves
   * nothing behind. Structural validation of the backup file happens in services/backup.ts;
   * here we only guard the relation between the round and what hangs from it.
   */
  async function importRound(data: RoundWithHoles): Promise<ImportResult> {
    const { round, holes, weather, shots } = data;

    if (holes.some((h) => h.roundId !== round.id)) {
      throw new Error(`Round ${round.id} contains holes that belong to another round`);
    }
    if (weather && weather.roundId !== round.id) {
      throw new Error(`Round ${round.id} contains weather that belongs to another round`);
    }
    if (shots?.some((s) => s.roundId !== round.id)) {
      throw new Error(`Round ${round.id} contains shots that belong to another round`);
    }

    return database.transaction(
      'rw',
      database.rounds,
      database.holes,
      database.weather,
      database.shots,
      async () => {
        if (await database.rounds.get(round.id)) {
          return 'skipped' as const;
        }
        await database.rounds.add(round);
        await database.holes.bulkAdd(holes);
        if (weather) await database.weather.add(weather);
        if (shots && shots.length > 0) await database.shots.bulkAdd(shots);
        return 'imported' as const;
      },
    );
  }

  async function getWeather(roundId: string): Promise<RoundWeather | undefined> {
    return database.weather.get(roundId);
  }

  /**
   * Stores (or replaces) the weather of an existing round.
   * It does NOT touch Round.updatedAt: a background fill must not make the backup nudge
   * think the round was edited.
   */
  async function saveWeather(weather: RoundWeather): Promise<void> {
    await database.transaction('rw', database.rounds, database.weather, async () => {
      if (!(await database.rounds.get(weather.roundId))) {
        throw new Error(`Round ${weather.roundId} does not exist`);
      }
      await database.weather.put(weather);
    });
  }

  /** Rounds that have no weather yet, newest first. */
  async function listRoundsMissingWeather(): Promise<Round[]> {
    return database.transaction('r', database.rounds, database.weather, async () => {
      const withWeather = new Set(await database.weather.toCollection().primaryKeys());
      const rounds = await database.rounds.toArray();
      return rounds
        .filter((round) => !withWeather.has(round.id))
        .sort((a, b) => b.date.localeCompare(a.date));
    });
  }

  /** Shots of one hole, ordered by sequence. */
  async function getHoleShots(roundId: string, holeNumber: number): Promise<Shot[]> {
    const shots = await database.shots
      .where('roundId')
      .equals(roundId)
      .filter((shot) => shot.holeNumber === holeNumber)
      .toArray();
    return shots.sort((a, b) => a.sequence - b.sequence);
  }

  /** Every shot of a round, ordered by hole number and sequence. */
  async function getRoundShots(roundId: string): Promise<Shot[]> {
    return sortShots(await database.shots.where('roundId').equals(roundId).toArray());
  }

  /**
   * Replaces ALL the shots of one hole in a single transaction. `sequence` is assigned from the
   * array order (1, 2, 3...), so deleting or reordering shots never collides with the unique
   * index. An empty array clears the hole. Shots are user data, so Round.updatedAt IS bumped
   * (unlike the weather fill) and the backup nudge counts them.
   * Throws, writing nothing, if the round or hole does not exist, a shot is invalid, or an id
   * is repeated. It never looks at the score: a mismatch with it must not block saving (D37).
   */
  async function saveHoleShots(
    roundId: string,
    holeNumber: number,
    input: readonly ShotInput[],
  ): Promise<Shot[]> {
    return database.transaction(
      'rw',
      database.rounds,
      database.holes,
      database.shots,
      async () => {
        const round = await database.rounds.get(roundId);
        if (!round) throw new Error(`Round ${roundId} does not exist`);

        const hole = await database.holes
          .where('[roundId+holeNumber]')
          .equals([roundId, holeNumber])
          .first();
        if (!hole) throw new Error(`Round ${roundId} has no hole ${holeNumber}`);

        const shots: Shot[] = input.map((shot, index) => ({
          id: shot.id,
          roundId,
          holeNumber,
          sequence: index + 1,
          club: shot.club,
          fix: shot.fix,
          createdAt: shot.createdAt,
        }));

        const ids = new Set<string>();
        for (const shot of shots) {
          if (typeof shot.id !== 'string' || shot.id.trim() === '' || ids.has(shot.id)) {
            throw new Error(`Shot ${shot.sequence} has a missing or repeated id`);
          }
          ids.add(shot.id);
          const errors = validateShot(shot, round);
          if (errors.length > 0) {
            throw new Error(
              `Shot ${shot.sequence} is invalid: ${errors.map((e) => e.code).join(', ')}`,
            );
          }
        }

        await database.shots
          .where('roundId')
          .equals(roundId)
          .filter((existing) => existing.holeNumber === holeNumber)
          .delete();
        await database.shots.bulkAdd(shots);
        await database.rounds.update(roundId, { updatedAt: now() });
        return shots;
      },
    );
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
    getWeather,
    saveWeather,
    listRoundsMissingWeather,
    getHoleShots,
    getRoundShots,
    saveHoleShots,
  };
}

export type RoundRepository = ReturnType<typeof createRoundRepository>;

export const roundRepository = createRoundRepository(defaultDb);