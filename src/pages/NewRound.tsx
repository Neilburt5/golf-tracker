import { useState } from 'react';
import { ActiveRoundCard } from '../components/ActiveRoundCard';
import { BigButton, BigLink } from '../components/BigButton';
import { OptionGroup } from '../components/OptionGroup';
import { useActiveRound } from '../hooks/useActiveRound';
import { useNewRoundForm, type HoleRange } from '../hooks/useNewRoundForm';

export function NewRound() {
  const active = useActiveRound();
  const form = useNewRoundForm();
  const [startAnyway, setStartAnyway] = useState(false);

  if (active.status === 'loading') {
    return <p className="muted">Cargando…</p>;
  }

  if (active.status === 'ready' && active.round && !startAnyway) {
    return (
      <div className="screen">
        <h1 className="title">Ya tienes una ronda en curso</h1>
        <ActiveRoundCard round={active.round} holeNumber={active.resumeHoleNumber} />
        <p className="muted">
          Si empiezas otra, la actual no se borra, pero Inicio mostrará la nueva.
        </p>
        <BigLink to={`/round/${active.round.id}/hole/${active.resumeHoleNumber}`}>
          Continuar la ronda en curso
        </BigLink>
        <BigButton variant="secondary" onClick={() => setStartAnyway(true)}>
          Empezar una nueva de todos modos
        </BigButton>
      </div>
    );
  }

  const { course } = form;

  function rangeLabel(range: HoleRange): string {
    if (range === 'front') return 'Primeros 9';
    if (range === 'back') return 'Últimos 9';
    return `${course?.numberOfHoles ?? 18} hoyos`;
  }

  return (
    <div className="screen">
      <h1 className="title">Nueva ronda</h1>

      <OptionGroup
        legend="Campo"
        options={form.courses.map((c) => ({ value: c.id, label: c.name }))}
        value={course?.id ?? ''}
        onChange={form.selectCourse}
      />

      {course && (
        <>
          <OptionGroup
            legend="Tees"
            options={course.tees.map((t) => ({ value: t, label: t }))}
            value={form.tee}
            onChange={form.setTee}
          />
          <OptionGroup
            legend="Recorrido"
            options={form.rangeOptions.map((r) => ({ value: r, label: rangeLabel(r) }))}
            value={form.range}
            onChange={form.setRange}
          />
        </>
      )}

      {form.error && (
        <p role="alert" className="error">
          {form.error}
        </p>
      )}

      <BigButton disabled={!form.canSubmit} onClick={() => void form.submit()}>
        {form.submitting ? 'Creando…' : 'Empezar ronda'}
      </BigButton>
      <BigLink to="/" variant="secondary">
        Cancelar
      </BigLink>
    </div>
  );
}