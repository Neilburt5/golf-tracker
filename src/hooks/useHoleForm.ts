import { useCallback, useEffect, useRef, useState } from 'react';
import { suggestGir } from '../domain/calculations';
import { validateHole, type ValidationError } from '../domain/validation';
import type { Hole, Round } from '../domain/types';
import { roundRepository } from '../data/roundRepository';

const DEBOUNCE_MS = 400;

export type LoadState = 'loading' | 'ready' | 'not_found' | 'error';
export type SaveStatus = 'saved' | 'saving' | 'error';

/** Fields the user can edit on the hole screen. */
export type HolePatch = Partial<
  Pick<Hole, 'score' | 'putts' | 'fairway' | 'gir' | 'penaltyStrokes' | 'bunker' | 'upAndDown'>
>;

/** Fairway does not apply on par 3. */
function normalizeHole(hole: Hole): Hole {
  return hole.par === 3 && hole.fairway !== null ? { ...hole, fairway: null } : hole;
}

/**
 * View-model for the hole screen.
 * Keeps all holes of the round in memory, edits are applied immediately
 * and persisted through a debounced, ordered write queue.
 */
export function useHoleForm(roundId: string, holeNumber: number) {
  const [round, setRound] = useState<Round | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [loaded, setLoaded] = useState<{
  roundId: string;
  state: Exclude<LoadState, 'loading'>;
} | null>(null);
/** Derived: "loading" until the result for the current roundId has arrived. */
const loadState: LoadState = loaded?.roundId === roundId ? loaded.state : 'loading';
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  const roundRef = useRef<Round | null>(null);
  const holesRef = useRef<Hole[]>([]);
  /** Hole numbers with changes not yet written to IndexedDB. */
  const dirtyRef = useRef<Set<number>>(new Set());
  /** Hole numbers whose GIR the user set by hand (no more auto-suggestion). */
  const girManualRef = useRef<Set<number>>(new Set());
  const timerRef = useRef<number | undefined>(undefined);
  const queueRef = useRef<Promise<boolean>>(Promise.resolve(true));

  /** Writes pending changes. Resolves true when everything is persisted. */
  const flush = useCallback((): Promise<boolean> => {
    window.clearTimeout(timerRef.current);
    timerRef.current = undefined;

    const currentRound = roundRef.current;
    const pending = holesRef.current.filter((h) => dirtyRef.current.has(h.holeNumber));
    dirtyRef.current.clear();

    if (currentRound && pending.length > 0) {
      const valid = pending.filter(
        (h) => validateHole(h, currentRound, { requireScore: false }).length === 0,
      );
      const hasInvalid = valid.length !== pending.length;

      setSaveStatus('saving');
      queueRef.current = queueRef.current
        .then(async () => {
          try {
            for (const hole of valid) {
              await roundRepository.saveHole(hole);
            }
            return !hasInvalid;
          } catch {
            valid.forEach((h) => dirtyRef.current.add(h.holeNumber)); // retry next flush
            return false;
          }
        })
        .then((ok) => {
          setSaveStatus(ok ? (dirtyRef.current.size === 0 ? 'saved' : 'saving') : 'error');
          return ok;
        });
    }
    return queueRef.current;
  }, []);

    // Load the round and its holes.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const loadedRound = await roundRepository.getRound(roundId);
        if (!loadedRound) {
          if (!cancelled) setLoaded({ roundId, state: 'not_found' });
          return;
        }
        const loadedHoles = (await roundRepository.getHoles(roundId)).map(normalizeHole);
        if (cancelled) return;

        girManualRef.current = new Set(
          loadedHoles
            .filter((h) => h.score !== null && h.gir !== suggestGir(h.score, h.putts, h.par))
            .map((h) => h.holeNumber),
        );
        dirtyRef.current.clear();
        roundRef.current = loadedRound;
        holesRef.current = loadedHoles;
        setRound(loadedRound);
        setHoles(loadedHoles);
        setSaveStatus('saved');
        setLoaded({ roundId, state: 'ready' });
      } catch {
        if (!cancelled) setLoaded({ roundId, state: 'error' });
      }
    })();

    return () => {
      cancelled = true;
      void flush(); // never leave pending changes behind
    };
  }, [roundId, flush]);

  // Safari can suspend or kill the page at any time: flush when it goes to the background.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    const onPageHide = () => void flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [flush]);

  const update = useCallback(
    (patch: HolePatch) => {
      const current = holesRef.current.find((h) => h.holeNumber === holeNumber);
      if (!current) return;

      const next: Hole = { ...current, ...patch };

      if ('gir' in patch) {
        girManualRef.current.add(holeNumber);
      } else if (
        ('score' in patch || 'putts' in patch) &&
        !girManualRef.current.has(holeNumber)
      ) {
        next.gir = next.score !== null && suggestGir(next.score, next.putts, next.par);
      }
      if (next.par === 3) next.fairway = null;

      holesRef.current = holesRef.current.map((h) => (h.id === next.id ? next : h));
      setHoles(holesRef.current);

      dirtyRef.current.add(holeNumber);
      setSaveStatus('saving');
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void flush(), DEBOUNCE_MS);
    },
    [holeNumber, flush],
  );

  const hole = holes.find((h) => h.holeNumber === holeNumber);

  /** Validation for "Save & next": the score is required. */
  const validateCurrent = useCallback((): ValidationError[] => {
    if (!round || !hole) return [];
    return validateHole(hole, round, { requireScore: true });
  }, [round, hole]);

  return { round, holes, hole, loadState, saveStatus, update, flush, validateCurrent };
}