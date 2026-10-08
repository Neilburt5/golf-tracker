import { useCallback, useMemo, useState } from 'react';
import { evaluateBackupNudge, type BackupNudge } from '../domain/backupNudge';
import type { RoundWithHoles } from '../domain/types';
import { readLastBackup, recordBackup } from '../services/backupStatus';

/** Last backup date (localStorage, D39) and a way to record a new one. */
export function useBackupStatus() {
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => readLastBackup());

  /** Records the date of a backup that was just shared or downloaded. Returns false if it could not be saved. */
  const markBackedUp = useCallback((at: string): boolean => {
    const saved = recordBackup(at);
    if (saved) setLastBackupAt(at);
    return saved;
  }, []);

  return { lastBackupAt, markBackedUp };
}

/** The nudge for the dashboard. Uses every round: it ignores the dashboard filter. */
export function useBackupNudge(rounds: readonly RoundWithHoles[]) {
  const { lastBackupAt } = useBackupStatus();
  const [now] = useState(() => new Date().toISOString());

  const nudge: BackupNudge = useMemo(
    () =>
      evaluateBackupNudge(
        rounds.map((data) => data.round),
        lastBackupAt,
        now,
      ),
    [rounds, lastBackupAt, now],
  );

  return { nudge, lastBackupAt };
}