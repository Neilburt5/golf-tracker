import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BigButton, BigLink } from '../components/BigButton';
import { HoleProgress } from '../components/HoleProgress';
import { Stepper } from '../components/Stepper';
import { YesNoToggle } from '../components/YesNoToggle';
import { holeScoreToPar } from '../domain/calculations';
import type { ValidationError } from '../domain/validation';
import { useHoleForm, type SaveStatus } from '../hooks/useHoleForm';
import { formatToPar } from '../domain/format';

const SAVE_STATUS_TEXT: Record<SaveStatus, string> = {
  saved: 'Guardado ✓',
  saving: 'Guardando…',
  error: 'No se pudo guardar',
};

function errorMessage(error: ValidationError): string {
  switch (error.code) {
    case 'score_required':
      return 'Indica el score antes de continuar.';
    default:
      return 'Revisa los datos del hoyo.';
  }
}

export function HoleTracking() {
  const { roundId = '', holeNumber: holeParam } = useParams();
  const holeNumber = Number(holeParam);
  const navigate = useNavigate();
  const form = useHoleForm(roundId, holeNumber);
  const { hole, holes, update } = form;

  const [errorState, setErrorState] = useState<{
    message: string;
    holeNumber: number;
    score: number | null | undefined;
  } | null>(null);
  // The message is only shown for the hole and score it was raised on,
  // so it disappears by itself when you change hole or set the score.
  const error =
    errorState && errorState.holeNumber === holeNumber && errorState.score === hole?.score
      ? errorState.message
      : null;
  const setError = (message: string) =>
    setErrorState({ message, holeNumber, score: hole?.score });

  if (form.loadState === 'loading') {
    return (
      <div className="screen">
        <p className="muted">Cargando…</p>
      </div>
    );
  }

  if (form.loadState === 'error') {
    return (
      <div className="screen">
        <h1 className="title">Error</h1>
        <p className="error">No se pudo cargar la ronda.</p>
        <BigLink to="/" variant="secondary">
          Inicio
        </BigLink>
      </div>
    );
  }

  if (form.loadState === 'not_found' || !hole || !form.round) {
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

  const index = holes.findIndex((h) => h.holeNumber === holeNumber);
  const previous = holes[index - 1];
  const next = holes[index + 1];
  const holePath = (n: number) => `/round/${roundId}/hole/${n}`;

  const goTo = async (n: number) => {
    if (!(await form.flush())) {
      setError('No se pudo guardar. Inténtalo de nuevo antes de cambiar de hoyo.');
      return;
    }
    navigate(holePath(n));
  };

  const handleSaveAndNext = async () => {
    const errors = form.validateCurrent();
    if (errors.length > 0) {
      setError(errorMessage(errors[0]));
      return;
    }
    if (!(await form.flush())) {
      setError('No se pudo guardar. Inténtalo de nuevo.');
      return;
    }
    navigate(next ? holePath(next.holeNumber) : `/round/${roundId}/summary`);
  };

  const score = hole.score;

  return (
    <div className="screen">
      <header className="hole-header">
        <h1 className="title">Hoyo {hole.holeNumber}</h1>
        <div className="hole-meta">
          <strong>Par {hole.par}</strong>
          <span className="muted">
            {index + 1} / {holes.length}
          </span>
        </div>
      </header>

      <HoleProgress holes={holes} currentHoleNumber={holeNumber} onSelect={goTo} />

      <div className="stack">
        <Stepper
          label="Score"
          value={score}
          hint={formatToPar(holeScoreToPar(hole))}
          canDecrement={score === null || score > 1}
          onIncrement={() => update({ score: score === null ? hole.par : score + 1 })}
          onDecrement={() =>
            update({ score: score === null ? Math.max(1, hole.par - 1) : Math.max(1, score - 1) })
          }
        />
        <Stepper
          label="Putts"
          value={hole.putts}
          canDecrement={hole.putts > 0}
          onIncrement={() => update({ putts: hole.putts + 1 })}
          onDecrement={() => update({ putts: Math.max(0, hole.putts - 1) })}
        />
        {hole.par !== 3 && (
          <YesNoToggle
            label="Calle (fairway)"
            value={hole.fairway}
            onChange={(value) => update({ fairway: value })}
          />
        )}
        <YesNoToggle
          label="Green en regulación (GIR)"
          value={hole.gir}
          onChange={(value) => update({ gir: value === true })}
        />
        <Stepper
          label="Penalizaciones"
          value={hole.penaltyStrokes}
          canDecrement={hole.penaltyStrokes > 0}
          onIncrement={() => update({ penaltyStrokes: hole.penaltyStrokes + 1 })}
          onDecrement={() => update({ penaltyStrokes: Math.max(0, hole.penaltyStrokes - 1) })}
        />
        <YesNoToggle
          label="Bunker"
          value={hole.bunker}
          onChange={(value) => update({ bunker: value === true })}
        />
        <YesNoToggle
          label="Up & down"
          value={hole.upAndDown}
          allowNotApplicable
          onChange={(value) => update({ upAndDown: value })}
        />
      </div>

      <div className="actions">
        <div className="save-status" role="status">
          <span className={form.saveStatus === 'error' ? 'error' : 'muted'}>
            {SAVE_STATUS_TEXT[form.saveStatus]}
          </span>
          {form.saveStatus === 'error' && (
            <button type="button" className="link-btn" onClick={() => void form.flush()}>
              Reintentar
            </button>
          )}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <BigButton onClick={handleSaveAndNext}>
          {next ? 'Guardar y siguiente' : 'Guardar y ver resumen'}
        </BigButton>
        <div className="actions-row">
          <BigButton
            variant="secondary"
            disabled={!previous}
            onClick={() => previous && goTo(previous.holeNumber)}
          >
            ‹ Anterior
          </BigButton>
          <BigLink to="/" variant="secondary">
            Inicio
          </BigLink>
        </div>
      </div>
    </div>
  );
}