import Dexie, { type Table } from 'dexie';
import type { Hole, Round, RoundWeather } from '../domain/types';

export const DB_NAME = 'golf-tracker';

export class GolfDatabase extends Dexie {
  rounds!: Table<Round, string>;
  holes!: Table<Hole, string>;
  weather!: Table<RoundWeather, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      rounds: 'id, status, date, updatedAt',
      // '&' = unique: one row per hole per round
      holes: 'id, roundId, &[roundId+holeNumber]',
    });
    // v2 (phase 14): weather snapshot per round, 1:1 with rounds. Existing tables are untouched.
    this.version(2).stores({
      weather: 'roundId',
    });
  }
}

export const db = new GolfDatabase();