/**
 * Date of the last successful backup, kept in localStorage (D39).
 * It is device metadata, not golf data: it is not part of the backup file or the Excel export.
 * Every access is wrapped because localStorage can throw (private mode, storage disabled).
 */

export const LAST_BACKUP_KEY = 'golf-tracker:last-backup-at';

export type BackupStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): BackupStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

/** ISO date of the last backup, or null if there is none or it cannot be read. */
export function readLastBackup(storage: BackupStorage | null = browserStorage()): string | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(LAST_BACKUP_KEY);
    return value !== null && isValidDate(value) ? value : null;
  } catch {
    return null;
  }
}

/** Stores the backup date. Returns false if it could not be saved. Never throws. */
export function recordBackup(
  at: string,
  storage: BackupStorage | null = browserStorage(),
): boolean {
  if (!storage || !isValidDate(at)) return false;
  try {
    storage.setItem(LAST_BACKUP_KEY, at);
    return true;
  } catch {
    return false;
  }
}