import { useState } from 'react';
import { BigButton } from './BigButton';
import { clubLabel, isPutter } from '../domain/clubs';
import { formatGpsState, formatShotDistance, type FixFailureReason } from '../domain/shotFormat';
import type { ShotWithDistance } from '../domain/shots';

interface ShotListProps {
  rows: readonly ShotWithDistance[];
  capturing: readonly string[];
  failures: Readonly<Record<string, FixFailureReason>>;
  editingId: string | null;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

/** The shots of the hole, in order. Deleting asks for an inline confirmation (D20 pattern). */
export function ShotList({ rows, capturing, failures, editingId, onEdit, onDelete }: ShotListProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="muted">Todavía no hay golpes en este hoyo.</p>;
  }

  return (
    <ol className="shot-list" aria-label="Golpes del hoyo">
      {rows.map(({ shot, distance }, index) => {
        const isCapturing = capturing.includes(shot.id);
        const gps = formatGpsState({
          capturing: isCapturing,
          fix: shot.fix,
          failure: failures[shot.id],
        });
        const putter = isPutter(shot.club);
        const classes = ['shot-row'];
        if (editingId === shot.id) classes.push('shot-row-editing');

        return (
          <li key={shot.id} className={classes.join(' ')}>
            <div className="shot-main">
              <span className="shot-number">{index + 1}</span>
              <strong className="shot-club">{clubLabel(shot.club)}</strong>
              <span className="shot-distance">
                {putter ? 'Putter marcado' : formatShotDistance(distance)}
              </span>
            </div>
            <span className="muted">{gps}</span>

            {confirmingId === shot.id ? (
              <div className="warning" role="alert">
                <strong>¿Eliminar este golpe?</strong>
                <div className="actions-row">
                  <BigButton variant="secondary" onClick={() => setConfirmingId(null)}>
                    Cancelar
                  </BigButton>
                  <BigButton
                    onClick={() => {
                      setConfirmingId(null);
                      onDelete(shot.id);
                    }}
                  >
                    Sí, eliminar
                  </BigButton>
                </div>
              </div>
            ) : (
              <div className="actions-row">
                <BigButton variant="secondary" onClick={() => onEdit(shot.id)}>
                  Cambiar palo
                </BigButton>
                <BigButton variant="secondary" onClick={() => setConfirmingId(shot.id)}>
                  Eliminar
                </BigButton>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}