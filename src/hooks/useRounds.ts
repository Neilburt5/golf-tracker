import { useCallback, useEffect, useState } from 'react';
import { roundRepository } from '../data/roundRepository';
import type { RoundWithHoles } from '../domain/types';
import {
  parseBackup,
  restoreBackup,
  type BackupErrorCode,
  type RestoreSummary,
} from '../services/backup';

export type RoundsLoadState = 'loading' | 'ready' | 'error';

export type RestoreOutcome =
  | { kind: 'done'; summary: RestoreSummary }
  | { kind: 'invalid'; code: BackupErrorCode }
  | { kind: 'unreadable' };

type Result = { status: 'ready'; rounds: RoundWithHoles[] } | { status: 'error' };

/** View-model for the rounds list: loading, deleting and restoring backups. */
export function useRounds() {
  const [result, setResult] = useState<Result | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rounds = await roundRepository.listRoundsWithHoles();
        if (!cancelled) setResult({ status: 'ready', rounds });
      } catch {
        if (!cancelled) setResult({ status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  /** Permanently deletes a round. The page asks for confirmation first. Returns false on failure. */
  const remove = useCallback(
    async (roundId: string): Promise<boolean> => {
      try {
        await roundRepository.deleteRound(roundId);
        reload();
        return true;
      } catch {
        return false;
      }
    },
    [reload],
  );

  /** Validates the whole file first, then inserts missing rounds. Never overwrites. */
  const restore = useCallback(
    async (file: File): Promise<RestoreOutcome> => {
      let text: string;
      try {
        text = await file.text();
      } catch {
        return { kind: 'unreadable' };
      }

      const parsed = parseBackup(text);
      if (!parsed.ok) return { kind: 'invalid', code: parsed.code };

      const summary = await restoreBackup(parsed.backup, roundRepository);
      reload();
      return { kind: 'done', summary };
    },
    [reload],
  );

  const loadState: RoundsLoadState = result ? result.status : 'loading';

  return {
    loadState,
    rounds: result?.status === 'ready' ? result.rounds : [],
    remove,
    restore,
  };
}