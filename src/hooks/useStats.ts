import { useCallback, useEffect, useMemo, useState } from 'react';
import { roundRepository } from '../data/roundRepository';
import {
  calculateStats,
  filterRounds,
  isFinishedRound,
  listCourseOptions,
  type CourseOption,
  type Stats,
  type StatsFilter,
} from '../domain/stats';
import type { NumberOfHoles, RoundWithHoles } from '../domain/types';

export type StatsLoadState = 'loading' | 'ready' | 'error';

type Result = { status: 'ready'; rounds: RoundWithHoles[] } | { status: 'error' };

const DEFAULT_FILTER: StatsFilter = { courseId: null, numberOfHoles: 18 };
const NO_ROUNDS: RoundWithHoles[] = [];

/**
 * View-model for the dashboard: loads all rounds once and holds the filter.
 * Every figure comes from domain/stats.ts; this hook only wires things together.
 */
export function useStats() {
  const [result, setResult] = useState<Result | null>(null);
  const [filter, setFilter] = useState<StatsFilter>(DEFAULT_FILTER);

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
  }, []);

  const setCourseId = useCallback((courseId: string | null) => {
    setFilter((current: StatsFilter) => ({ ...current, courseId }));
  }, []);

  const setNumberOfHoles = useCallback((numberOfHoles: NumberOfHoles | null) => {
    setFilter((current: StatsFilter) => ({ ...current, numberOfHoles }));
  }, []);

  const allRounds = result?.status === 'ready' ? result.rounds : NO_ROUNDS;

  const courses: CourseOption[] = useMemo(() => listCourseOptions(allRounds), [allRounds]);
  const stats: Stats = useMemo(() => calculateStats(allRounds, filter), [allRounds, filter]);

  // Same order as the repository returns them: newest first.
  const finishedRounds: RoundWithHoles[] = useMemo(
    () => filterRounds(allRounds, filter).filter(isFinishedRound),
    [allRounds, filter],
  );

  const loadState: StatsLoadState = result ? result.status : 'loading';

  return {
    loadState,
    filter,
    setCourseId,
    setNumberOfHoles,
    courses,
    stats,
    finishedRounds,
    /** Every round, ignoring the filter (used by the backup nudge). */
    allRounds,
  };
}