import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { roundRepository } from '../data/roundRepository';
import { settingsRepository } from '../data/settingsRepository';
import { DEFAULT_CLUB_BAG, type ClubCode } from '../domain/clubs';
import { newestFix } from '../domain/holeTargets';
import {
  appendShot,
  attachFix,
  changeClub as changeShotClub,
  createShotInput,
  removeShot as removeShotFromList,
} from '../domain/shotEditing';
import type { FixFailureReason } from '../domain/shotFormat';
import {
  reconcileHole,
  withShotDistances,
  type Reconciliation,
  type ShotWithDistance,
} from '../domain/shots';
import type { Hole, Round, Shot, ShotInput } from '../domain/types';
import { captureCoordinator } from '../services/captureCoordinator';

export type ShotsLoadState = 'loading' | 'ready' | 'not_found' | 'error';
export type ShotsSaveStatus = 'saved' | 'saving' | 'error';

function toInput(shot: Shot): ShotInput {
  return { id: shot.id, club: shot.club, fix: shot.fix, createdAt: shot.createdAt };
}

/**
 * View-model of the shots screen (phase 17).
 * - A club tap saves the shot at once with `fix: null`; the position is attached when the
 *   bounded capture ends. GPS never delays or blocks anything (D37).
 * - It has its own write queue and never touches useHoleForm, so hole autosave is unaffected.
 * - Captures are cancelled when the screen is left or the page goes to the background (D41).
 * - Phase 18: the capture of a club tap goes through the capture coordinator, which cancels
 *   the live info capture so two captures never compete (D32).
 */
export function useHoleShots(roundId: string, holeNumber: number) {
  const key = `${roundId}:${holeNumber}`;

  const [loaded, setLoaded] = useState<{ key: string; state: 'ready' | 'not_found' | 'error' } | null>(
    null,
  );
  const loadState: ShotsLoadState = loaded?.key === key ? loaded.state : 'loading';

  const [round, setRound] = useState<Round | null>(null);
  const [hole, setHole] = useState<Hole | null>(null);
  const [bag, setBag] = useState<ClubCode[]>([...DEFAULT_CLUB_BAG]);
  const [shots, setShots] = useState<ShotInput[]>([]);
  const [capturing, setCapturing] = useState<string[]>([]);
  const [failures, setFailures] = useState<Record<string, FixFailureReason>>({});
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<ShotsSaveStatus>('saved');

  const shotsRef = useRef<ShotInput[]>([]);
  const readyRef = useRef(false);
  /** Bumped whenever the hole changes or the screen is left; late captures check it. */
  const generationRef = useRef(0);
  const cancelsRef = useRef<Map<string, () => void>>(new Map());
  const queueRef = useRef<Promise<boolean>>(Promise.resolve(true));

  /** Serial write of a snapshot of the list. Each write replaces the whole hole (D56). */
  const persist = useCallback((): Promise<boolean> => {
    const snapshot = shotsRef.current;
    setSaveStatus('saving');
    queueRef.current = queueRef.current
      .then(async () => {
        try {
          await roundRepository.saveHoleShots(roundId, holeNumber, snapshot);
          return true;
        } catch {
          return false;
        }
      })
      .then((ok) => {
        setSaveStatus(ok ? 'saved' : 'error');
        return ok;
      });
    return queueRef.current;
  }, [roundId, holeNumber]);

  const applyShots = useCallback(
    (next: ShotInput[]) => {
      shotsRef.current = next;
      setShots(next);
      void persist();
    },
    [persist],
  );

  // Load the round, the hole, the club bag and the stored shots.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const loadedRound = await roundRepository.getRound(roundId);
        if (!loadedRound) {
          if (!cancelled) setLoaded({ key, state: 'not_found' });
          return;
        }
        const [holes, stored, storedBag] = await Promise.all([
          roundRepository.getHoles(roundId),
          roundRepository.getHoleShots(roundId, holeNumber),
          settingsRepository.getClubBag().catch(() => [...DEFAULT_CLUB_BAG]),
        ]);
        if (cancelled) return;

        const loadedHole = holes.find((h) => h.holeNumber === holeNumber);
        if (!loadedHole) {
          setLoaded({ key, state: 'not_found' });
          return;
        }

        const inputs = stored.map(toInput);
        shotsRef.current = inputs;
        readyRef.current = true;
        setRound(loadedRound);
        setHole(loadedHole);
        setBag(storedBag);
        setShots(inputs);
        setCapturing([]);
        setFailures({});
        setPermissionDenied(false);
        setSaveStatus('saved');
        setLoaded({ key, state: 'ready' });
      } catch {
        if (!cancelled) setLoaded({ key, state: 'error' });
      }
    })();

    const cancels = cancelsRef.current;
    return () => {
      cancelled = true;
      readyRef.current = false;
      generationRef.current += 1;
      // Leaving the screen must never leave a watch running (D32 amendment).
      cancels.forEach((cancel) => cancel());
      cancels.clear();
    };
  }, [roundId, holeNumber, key]);

  // D41: a capture cannot be trusted across a lock or an app switch. Discard it; the club stays.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        cancelsRef.current.forEach((cancel) => cancel());
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  /**
   * One tap = one shot. Must be called straight from the tap handler: the capture starts
   * synchronously (keeps the user gesture, D43) and the shot is saved before any position
   * arrives. `settled` resolves when the capture has ended, with or without a position.
   * Returns null while the screen is not ready.
   */
  const addShot = useCallback(
    (club: ClubCode): { id: string; settled: Promise<void> } | null => {
      if (!readyRef.current) return null;

      const id = crypto.randomUUID();
      const generation = generationRef.current;
      // Phase 18: the coordinator cancels the live info capture first, then starts this one.
      const capture = captureCoordinator.startShot();
      cancelsRef.current.set(id, capture.cancel);

      setCapturing((previous) => [...previous, id]);
      applyShots(appendShot(shotsRef.current, createShotInput(id, club, new Date().toISOString())));

      const settled = capture.result.then((outcome) => {
        cancelsRef.current.delete(id);
        if (generation !== generationRef.current) return; // another hole or screen by now
        setCapturing((previous) => previous.filter((item) => item !== id));
        if (outcome.ok) {
          applyShots(attachFix(shotsRef.current, id, outcome.fix));
        } else {
          setFailures((previous) => ({ ...previous, [id]: outcome.reason }));
          if (outcome.reason === 'permission_denied') setPermissionDenied(true);
        }
      });

      return { id, settled };
    },
    [applyShots],
  );

  const changeClub = useCallback(
    (id: string, club: ClubCode) => {
      if (!readyRef.current) return;
      applyShots(changeShotClub(shotsRef.current, id, club));
    },
    [applyShots],
  );

  const removeShot = useCallback(
    (id: string) => {
      if (!readyRef.current) return;
      cancelsRef.current.get(id)?.(); // a deleted shot must not keep listening
      applyShots(removeShotFromList(shotsRef.current, id));
    },
    [applyShots],
  );

  const retrySave = useCallback(() => void persist(), [persist]);

  const rows: ShotWithDistance[] = useMemo(
    () =>
      withShotDistances(
        shots.map((shot, index) => ({ ...shot, roundId, holeNumber, sequence: index + 1 })),
      ),
    [shots, roundId, holeNumber],
  );

  const reconciliation: Reconciliation | null = useMemo(
    () => (hole ? reconcileHole(hole, shots) : null),
    [hole, shots],
  );

  /** Newest position among the shots of this hole; the live panel reuses it for free (D32). */
  const lastFix = useMemo(() => newestFix(shots.map((shot) => shot.fix)), [shots]);

  return {
    loadState,
    round,
    hole,
    bag,
    rows,
    capturing,
    failures,
    permissionDenied,
    saveStatus,
    reconciliation,
    lastFix,
    addShot,
    changeClub,
    removeShot,
    retrySave,
  };
}