import { useParams } from 'react-router-dom';
import { BigLink } from '../components/BigButton';

/** Placeholder: the real summary is built in phase 6. */
export function RoundSummary() {
  const { roundId } = useParams();

  return (
    <div className="screen">
      <h1 className="title">Resumen</h1>
      <p className="muted">Pantalla en construcción (fase 6).</p>
      <p className="build">Ronda: {roundId}</p>
      <BigLink to="/" variant="secondary">
        Inicio
      </BigLink>
    </div>
  );
}