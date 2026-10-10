import { useNavigate } from 'react-router-dom';
import { ActiveRoundCard } from '../components/ActiveRoundCard';
import { BigLink } from '../components/BigButton';
import { useActiveRound } from '../hooks/useActiveRound';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useTapSequence } from '../hooks/useTapSequence';

export function Home() {
  const active = useActiveRound();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  // Hidden entry to the GPS field test (phase 13): tap the build line 5 times quickly.
  const onBuildTap = useTapSequence(5, 3000, () => navigate('/gps-test'));
  const hasActiveRound = active.status === 'ready' && active.round !== null;

  return (
    <div className="screen">
      <h1 className="title">Golf Tracker</h1>

      {active.status === 'loading' && <p className="muted">Cargando…</p>}

      {active.status === 'error' && (
        <p role="alert" className="error">
          No se pudo leer la ronda guardada: {active.message}
        </p>
      )}

      {active.status === 'ready' && active.round && (
        <section className="stack">
          <ActiveRoundCard round={active.round} holeNumber={active.resumeHoleNumber} />
          <BigLink to={`/round/${active.round.id}/hole/${active.resumeHoleNumber}`}>
            Continuar ronda
          </BigLink>
        </section>
      )}

      <BigLink to="/new" variant={hasActiveRound ? 'secondary' : 'primary'}>
        Nueva ronda
      </BigLink>

      <BigLink to="/rounds" variant="secondary">
        Mis rondas
      </BigLink>

      <BigLink to="/stats" variant="secondary">
        Estadísticas
      </BigLink>

      <footer className="footer">
        <span className={online ? 'status online' : 'status offline'}>
          {online ? 'Con conexión' : 'Sin conexión'}
        </span>
        <span className="build build-tap" onClick={onBuildTap}>
          Build: {__BUILD_TIME__}
        </span>
      </footer>
    </div>
  );
}