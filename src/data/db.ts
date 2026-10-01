import Dexie, { type Table } from 'dexie';
import type { Hole, Round } from '../domain/types';

export const DB_NAME = 'golf-tracker';

export class GolfDatabase extends Dexie {
  rounds!: Table<Round, string>;
  holes!: Table<Hole, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      rounds: 'id, status, date, updatedAt',
      // '&' = unique: one row per hole per round
      holes: 'id, roundId, &[roundId+holeNumber]',
    });
  }
}

export const db = new GolfDatabase();