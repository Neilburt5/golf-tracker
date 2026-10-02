import { useCallback, useEffect, useState } from 'react';
import { roundRepository } from '../data/roundRepository';
import type { Hole, Round } from '../domain/types';

export type SummaryLoadState = 'loading' | 'ready' | 'not_found' | 'error';

type Result =
  | { roundId: string; status: 'ready'; round: Round; holes: Hole[] }
  | { roundId: string; status: 'not_found' | 'error' };

export function useRoundSummary(roundId: string) {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const round = await roundRepository.getRound(roundId);
        if (!round) {
          if (!cancelled) setResult({ roundId, status: 'not_found' });
          return;
        }
        const holes = await roundRepository.getHoles(roundId);
        if (!cancelled) setResult({ roundId, status: 'ready', round, holes });
      } catch {
        if (!cancelled) setResult({ roundId, status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roundId]);

  /** Marks the round as finished. Returns false if it could not be saved. */
  const finish = useCallback(async (): Promise<boolean> => {
    try {
      const finished = await roundRepository.finishRound(roundId);
      setResult((prev) =>
        prev && prev.status === 'ready' && prev.roundId === roundId
          ? { ...prev, round: finished }
          : prev,
      );
      return true;
    } catch {
      return false;
    }
  }, [roundId]);

  // Derived: a result for another round id counts as still loading.
  const current = result && result.roundId === roundId ? result : null;
  const loadState: SummaryLoadState = current ? current.status : 'loading';

  return {
    loadState,
    round: current?.status === 'ready' ? current.round : null,
    holes: current?.status === 'ready' ? current.holes : [],
    finish,
  };
}