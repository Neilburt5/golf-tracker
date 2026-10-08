import { describe, expect, it } from 'vitest';
import {
  LAST_BACKUP_KEY,
  readLastBackup,
  recordBackup,
  type BackupStorage,
} from '../src/services/backupStatus';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: BackupStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
  return { storage, data };
}

const throwing: BackupStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

const DATE = '2026-10-08T10:00:00.000Z';

describe('readLastBackup', () => {
  it('returns null when nothing was recorded', () => {
    expect(readLastBackup(memoryStorage().storage)).toBeNull();
  });

  it('returns what recordBackup stored', () => {
    const { storage } = memoryStorage();
    expect(recordBackup(DATE, storage)).toBe(true);
    expect(readLastBackup(storage)).toBe(DATE);
  });

  it('ignores a stored value that is not a date', () => {
    const { storage } = memoryStorage({ [LAST_BACKUP_KEY]: 'garbage' });
    expect(readLastBackup(storage)).toBeNull();
  });

  it('returns null instead of throwing when storage is blocked or missing', () => {
    expect(readLastBackup(throwing)).toBeNull();
    expect(readLastBackup(null)).toBeNull();
  });
});

describe('recordBackup', () => {
  it('overwrites the previous date', () => {
    const { storage } = memoryStorage();
    recordBackup('2026-09-01T10:00:00.000Z', storage);
    recordBackup(DATE, storage);
    expect(readLastBackup(storage)).toBe(DATE);
  });

  it('refuses an invalid date and writes nothing', () => {
    const { storage, data } = memoryStorage();
    expect(recordBackup('nope', storage)).toBe(false);
    expect(data.size).toBe(0);
  });

  it('returns false instead of throwing when storage is blocked or missing', () => {
    expect(recordBackup(DATE, throwing)).toBe(false);
    expect(recordBackup(DATE, null)).toBe(false);
  });
});