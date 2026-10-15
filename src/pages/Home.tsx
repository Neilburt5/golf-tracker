import { useNavigate } from 'react-router-dom';
import { ActiveRoundCard } from '../components/ActiveRoundCard';
import { BigLink } from '../components/BigButton';
import { useActiveRound } from '../hooks/useActiveRound';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useTapSequence } from '../hooks/useTapSequence';
import { useWeatherBackfill } from '../hooks/useWeather';
import { resumePath } from '../domain/resume';

export function Home() {
  const active = useActiveRound();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  useWeatherBackfill();
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
                    <BigLink
            to={resumePath(active.round.id, {
              holeNumber: active.resumeHoleNumber,
              screen: active.resumeScreen,
            })}
          >
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