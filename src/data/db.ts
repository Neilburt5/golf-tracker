import Dexie, { type Table } from 'dexie';
import type { ClubBagSetting, Hole, Round, RoundWeather, Shot } from '../domain/types';

export const DB_NAME = 'golf-tracker';

export class GolfDatabase extends Dexie {
  rounds!: Table<Round, string>;
  holes!: Table<Hole, string>;
  weather!: Table<RoundWeather, string>;
  shots!: Table<Shot, string>;
  settings!: Table<ClubBagSetting, string>;

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
    // v3 (phase 16): shots (linked to a hole by [roundId+holeNumber]) and device settings
    // (the club bag). Only adds tables, so no data migration is needed.
    this.version(3).stores({
      shots: 'id, roundId, &[roundId+holeNumber+sequence]',
      settings: 'key',
    });
  }
}

export const db = new GolfDatabase();