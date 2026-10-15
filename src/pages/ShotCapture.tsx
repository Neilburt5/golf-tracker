import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BigButton, BigLink } from '../components/BigButton';
import { ClubGrid } from '../components/ClubGrid';
import { ShotList } from '../components/ShotList';
import { clubLabel, isPutter, type ClubCode } from '../domain/clubs';
import { formatReconciliation } from '../domain/shotFormat';
import { useHoleShots, type ShotsSaveStatus } from '../hooks/useHoleShots';

const SAVE_STATUS_TEXT: Record<ShotsSaveStatus, string> = {
  saved: 'Guardado ✓',
  saving: 'Guardando…',
  error: 'No se pudo guardar',
};

export function ShotCapture() {
  const { roundId = '', holeNumber: holeParam } = useParams();
  const holeNumber = Number(holeParam);
  const navigate = useNavigate();
  const shots = useHoleShots(roundId, holeNumber);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [putterPending, setPutterPending] = useState(false);
  const leftRef = useRef(false);

  const holePath = `/round/${roundId}/hole/${holeNumber}`;

  const goToHole = () => {
    if (leftRef.current) return;
    leftRef.current = true;
    navigate(holePath);
  };

  if (shots.loadState === 'loading') {
    return (
      <div className="screen">
        <p className="muted">Cargando…</p>
      </div>
    );
  }

  if (shots.loadState === 'error') {
    return (
      <div className="screen">
        <h1 className="title">Error</h1>
        <p className="error">No se pudieron cargar los golpes.</p>
        <BigLink to="/" variant="secondary">
          Inicio
        </BigLink>
      </div>
    );
  }

  if (shots.loadState === 'not_found' || !shots.hole) {
    return (
      <div className="screen">
        <h1 className="title">No encontrado</h1>
        <p className="muted">Esta ronda o este hoyo no existe.</p>
        <BigLink to="/" variant="secondary">
          Inicio
        </BigLink>
      </div>
    );
  }

  const editing = editingId !== null;

  const handleClub = (club: ClubCode) => {
    if (editingId !== null) {
      shots.changeClub(editingId, club);
      setEditingId(null);
      return;
    }
    // addShot starts the capture synchronously from this tap and saves the club at once.
    const added = shots.addShot(club);
    if (added && isPutter(club)) {
      setPutterPending(true);
      // Hand over to the hole screen as soon as the position settles (about 1 s usually).
      void added.settled.then(goToHole);
    }
  };

  return (
    <div className="screen shots-screen">
      <header className="hole-header">
        <h1 className="title">Hoyo {shots.hole.holeNumber}</h1>
        <div className="hole-meta">
          <strong>Par {shots.hole.par}</strong>
        </div>
      </header>

      {/* Phase 18: distance to the green / landmarks and wind go here. */}

      {shots.permissionDenied && (
        <div className="warning" role="status">
          <strong>Ubicación desactivada</strong>
          <span>
            Los palos se guardan igual, sin posición. Para activarla: Ajustes de iOS › Privacidad y
            seguridad › Localización › Safari (o Golf Tracker) › Al usar la app.
          </span>
        </div>
      )}

      {editing ? (
        <div className="warning" role="status">
          <strong>
            Elige el nuevo palo
            {shots.rows.find((row) => row.shot.id === editingId)
              ? ` (ahora: ${clubLabel(shots.rows.find((row) => row.shot.id === editingId)!.shot.club)})`
              : ''}
          </strong>
          <BigButton variant="secondary" onClick={() => setEditingId(null)}>
            Cancelar cambio
          </BigButton>
        </div>
      ) : (
        <h2 className="subtitle">¿Qué palo has usado?</h2>
      )}

      <ClubGrid bag={shots.bag} onSelect={handleClub} disabled={putterPending} />

      {putterPending && (
        <div className="warning" role="status">
          <strong>Putter marcado · tomando posición…</strong>
          <BigButton variant="secondary" onClick={goToHole}>
            Ir al hoyo ya
          </BigButton>
        </div>
      )}

      <ShotList
        rows={shots.rows}
        capturing={shots.capturing}
        failures={shots.failures}
        editingId={editingId}
        onEdit={setEditingId}
        onDelete={shots.removeShot}
      />

      <div className="actions">
        <div className="save-status" role="status">
          <span className={shots.saveStatus === 'error' ? 'error' : 'muted'}>
            {SAVE_STATUS_TEXT[shots.saveStatus]}
          </span>
          {shots.saveStatus === 'error' && (
            <button type="button" className="link-btn" onClick={shots.retrySave}>
              Reintentar
            </button>
          )}
        </div>
        {shots.reconciliation && (
          <p className="muted">{formatReconciliation(shots.reconciliation)}</p>
        )}
        <BigButton onClick={goToHole}>Ir al hoyo ›</BigButton>
      </div>
    </div>
  );
}