import type { Reconciliation, ShotDistance } from './shots';
import type { ShotFix } from './types';

/**
 * Spanish texts for the shots screen (phase 17). Pure: no React, no browser APIs.
 */

/** Why a capture ended without a position. Not stored: after a reload only "Sin posición" remains. */
export type FixFailureReason =
  | 'permission_denied'
  | 'no_position'
  | 'only_stale'
  | 'interrupted'
  | 'unsupported';

const FAILURE_TEXT: Record<FixFailureReason, string> = {
  permission_denied: 'Sin posición (permiso denegado)',
  no_position: 'Sin posición (no llegó señal)',
  only_stale: 'Sin posición (señal antigua)',
  interrupted: 'Sin posición (interrumpida)',
  unsupported: 'Sin posición (GPS no disponible)',
};

/** "212 m ± 8", "212 m ± 8 · aprox." or "—" when it cannot be computed. */
export function formatShotDistance(distance: ShotDistance | null): string {
  if (!distance) return '—';
  const text = `${Math.round(distance.meters)} m ± ${Math.round(distance.uncertaintyM)}`;
  return distance.approximate ? `${text} · aprox.` : text;
}

export interface GpsState {
  /** A capture for this shot is still running. */
  capturing: boolean;
  fix: ShotFix | null;
  /** Known only in the session where the capture ended. */
  failure?: FixFailureReason;
}

export function formatGpsState({ capturing, fix, failure }: GpsState): string {
  if (capturing) return 'Tomando posición…';
  if (fix) {
    const accuracy = `GPS ±${Math.round(fix.accuracy)} m`;
    return fix.fresh ? accuracy : `${accuracy} · aproximada`;
  }
  return failure ? FAILURE_TEXT[failure] : 'Sin posición';
}

function strokes(count: number): string {
  return count === 1 ? '1 golpe' : `${count} golpes`;
}

/** One line comparing the shots with the score. Informational only (D37). */
export function formatReconciliation(reconciliation: Reconciliation): string {
  const { status, difference } = reconciliation;
  switch (status) {
    case 'not_tracked':
      return 'Sin golpes registrados';
    case 'not_played':
      return 'Se comparará cuando guardes el score';
    case 'match':
      return 'Cuadra con el score';
    case 'missing':
      return `Faltan ${strokes(difference ?? 0)}`;
    case 'extra': {
      const extra = Math.abs(difference ?? 0);
      return `${extra === 1 ? 'Sobra' : 'Sobran'} ${strokes(extra)}`;
    }
  }
}