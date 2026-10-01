import { useParams } from 'react-router-dom';
import { BigLink } from '../components/BigButton';

/** Placeholder: the real hole screen is built in phase 5. */
export function HoleTracking() {
  const { roundId, holeNumber } = useParams();

  return (
    <div className="screen">
      <h1 className="title">Hoyo {holeNumber}</h1>
      <p className="muted">Pantalla en construcción (fase 5).</p>
      <p className="build">Ronda: {roundId}</p>
      <BigLink to="/" variant="secondary">
        Inicio
      </BigLink>
    </div>
  );
}
