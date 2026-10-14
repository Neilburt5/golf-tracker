import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { GolfDatabase } from '../src/data/db';
import { createSettingsRepository } from '../src/data/settingsRepository';
import { CLUB_CATALOG, DEFAULT_CLUB_BAG, clubLabel, parseClubBag } from '../src/domain/clubs';

describe('club catalog', () => {
  it('is the 14-club set of the user, with the wedges named by loft', () => {
    expect(CLUB_CATALOG.map((c) => c.code)).toEqual([
      'driver', 'wood3', 'hybrid', 'iron4', 'iron5', 'iron6', 'iron7', 'iron8', 'iron9',
      'pw', 'wedge52', 'wedge56', 'wedge64', 'putter',
    ]);
    expect(clubLabel('wedge56')).toBe('56º');
    expect(clubLabel('hybrid')).toBe('Híbrido');
    expect(clubLabel('wood3')).toBe('Madera 3');
  });

  it('parseClubBag orders by catalog, adds the putter, and rejects bad input', () => {
    expect(parseClubBag(['pw', 'driver'])).toEqual(['driver', 'pw', 'putter']);
    expect(parseClubBag(['putter'])).toEqual(['putter']);
    expect(parseClubBag([])).toBeNull();
    expect(parseClubBag('driver')).toBeNull();
    expect(parseClubBag(['driver', 'driver'])).toBeNull();
    expect(parseClubBag(['driver', 'wood5'])).toBeNull();
  });
});

let counter = 0;
let db: GolfDatabase;

beforeEach(() => {
  counter += 1;
  db = new GolfDatabase(`bag-test-${counter}`);
});

describe('settings repository: club bag', () => {
  it('returns the full catalog until a bag is saved, and reports nothing stored', async () => {
    const repo = createSettingsRepository(db);
    expect(await repo.getStoredClubBag()).toBeUndefined();
    expect(await repo.getClubBag()).toEqual([...DEFAULT_CLUB_BAG]);
  });

  it('saves and reads back the bag, in catalog order and with the putter', async () => {
    const repo = createSettingsRepository(db);
    const stored = await repo.saveClubBag(['wedge56', 'driver', 'iron7']);
    expect(stored).toEqual(['driver', 'iron7', 'wedge56', 'putter']);
    expect(await repo.getClubBag()).toEqual(stored);
    expect(await repo.getStoredClubBag()).toEqual(stored);
  });

  it('replaces the previous bag', async () => {
    const repo = createSettingsRepository(db);
    await repo.saveClubBag(['driver']);
    await repo.saveClubBag(['pw']);
    expect(await repo.getClubBag()).toEqual(['pw', 'putter']);
    expect(await db.settings.count()).toBe(1);
  });

  it('rejects an empty bag, unknown or repeated clubs, writing nothing', async () => {
    const repo = createSettingsRepository(db);
    await expect(repo.saveClubBag([])).rejects.toThrow();
    await expect(repo.saveClubBag(['driver', 'driver'])).rejects.toThrow();
    await expect(repo.saveClubBag(['wood5' as never])).rejects.toThrow();
    expect(await repo.getStoredClubBag()).toBeUndefined();
  });

  it('ignores a damaged stored row and falls back to the default', async () => {
    await db.settings.put({ key: 'clubBag', value: ['nonsense'] as never });
    const repo = createSettingsRepository(db);
    expect(await repo.getStoredClubBag()).toBeUndefined();
    expect(await repo.getClubBag()).toEqual([...DEFAULT_CLUB_BAG]);
  });
});