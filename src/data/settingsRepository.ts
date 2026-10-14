import { db as defaultDb, type GolfDatabase } from './db';
import { DEFAULT_CLUB_BAG, parseClubBag, type ClubCode } from '../domain/clubs';

const CLUB_BAG_KEY = 'clubBag';

export function createSettingsRepository(database: GolfDatabase) {
  /** The bag the user saved, or undefined when none was ever configured (or the row is damaged). */
  async function getStoredClubBag(): Promise<ClubCode[] | undefined> {
    const row = await database.settings.get(CLUB_BAG_KEY);
    return (row ? parseClubBag(row.value) : null) ?? undefined;
  }

  /** The saved bag, or every club of the catalog until the user configures one. */
  async function getClubBag(): Promise<ClubCode[]> {
    return (await getStoredClubBag()) ?? [...DEFAULT_CLUB_BAG];
  }

  /**
   * Saves the bag in catalog order, always including the putter (see parseClubBag).
   * Throws for an empty bag, an unknown club or a repeated club. Returns what was stored.
   */
  async function saveClubBag(bag: readonly ClubCode[]): Promise<ClubCode[]> {
    const parsed = parseClubBag(bag);
    if (!parsed) throw new Error('A club bag must be a non-empty list of known clubs without repeats');
    await database.settings.put({ key: CLUB_BAG_KEY, value: parsed });
    return parsed;
  }

  return { getStoredClubBag, getClubBag, saveClubBag };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;

export const settingsRepository = createSettingsRepository(defaultDb);