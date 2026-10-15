import { BigLink } from './BigButton';
import type { ClubCode } from '../domain/clubs';
import { roundShotsPath } from '../domain/paths';
import { formatReconciliation } from '../domain/shotFormat';
import { reconcileHole } from '../domain/shots';
import type { Hole } from '../domain/types';

interface ShotsEntryProps {
  roundId: string;
  holeNumber: number;
  /** null while loading: nothing is shown until the shots are known. */
  clubs: readonly ClubCode[] | null;
  hole: Pick<Hole, 'score' | 'putts' | 'penaltyStrokes'>;
}

/** Link back to the shots screen with the informational reconciliation line (D37). */
export function ShotsEntry({ roundId, holeNumber, clubs, hole }: ShotsEntryProps) {
  if (clubs === null) return null;

  const reconciliation = reconcileHole(
    hole,
    clubs.map((club) => ({ club })),
  );
  const label =
    reconciliation.status === 'not_tracked'
      ? 'Registrar golpes'
      : `Golpes registrados: ${reconciliation.recorded}`;

  return (
    <div className="stack">
      <BigLink to={roundShotsPath(roundId, holeNumber)} variant="secondary">
        {label} ›
      </BigLink>
      {reconciliation.status !== 'not_tracked' && (
        <p className="muted">{formatReconciliation(reconciliation)}</p>
      )}
    </div>
  );
}