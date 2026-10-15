import { useEffect, useState } from 'react';
import { roundRepository } from '../data/roundRepository';
import type { ClubCode } from '../domain/clubs';

/**
 * Clubs of the shots saved for a hole, in order, or null while loading (or if they cannot be
 * read: shots are optional, so a read problem just hides the suggestion). Read-only.
 */
export function useHoleClubs(roundId: string, holeNumber: number): ClubCode[] | null {
  const key = `${roundId}:${holeNumber}`;
  const [loaded, setLoaded] = useState<{ key: string; clubs: ClubCode[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    roundRepository
      .getHoleShots(roundId, holeNumber)
      .then((shots) => {
        if (!cancelled) setLoaded({ key, clubs: shots.map((shot) => shot.club) });
      })
      .catch(() => {
        // Shots are optional: failing to read them must never affect the hole screen.
      });
    return () => {
      cancelled = true;
    };
  }, [roundId, holeNumber, key]);

  return loaded?.key === key ? loaded.clubs : null;
}