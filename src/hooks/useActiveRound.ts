import { useEffect, useState } from 'react';
import { roundRepository } from '../data/roundRepository';
import { findResumeHoleNumber } from '../domain/resume';
import type { Round } from '../domain/types';

export type ActiveRoundState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; round: null }
  | { status: 'ready'; round: Round; resumeHoleNumber: number };

/** Looks up the in-progress round and the hole where the user left off. */
export function useActiveRound(): ActiveRoundState {
  const [state, setState] = useState<ActiveRoundState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const round = await roundRepository.getInProgressRound();
        if (!round) {
          if (!cancelled) setState({ status: 'ready', round: null });
          return;
        }
        const holes = await roundRepository.getHoles(round.id);
        const resumeHoleNumber = findResumeHoleNumber(holes) ?? round.startHole;
        if (!cancelled) setState({ status: 'ready', round, resumeHoleNumber });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!cancelled) setState({ status: 'error', message });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}