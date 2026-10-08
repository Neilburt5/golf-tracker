import { Link } from 'react-router-dom';
import { BackupLine, BackupNudge } from '../components/BackupNudge';
import { BigLink } from '../components/BigButton';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { LossBreakdowns } from '../components/LossBreakdowns';
import { ScoreToParChart } from '../components/ScoreToParChart';
import { calculateRoundStats } from '../domain/calculations';
import {
  formatDecimal,
  formatPercentage,
  formatSignedDecimal,
  formatToPar,
  plural,
} from '../domain/format';
import type { RoundResult } from '../domain/stats';
import type { NumberOfHoles, RoundWithHoles } from '../domain/types';
import { useBackupNudge } from '../hooks/useBackupStatus';
import { useStats } from '../hooks/useStats';

/** Below this many finished rounds the figures are flagged as not conclusive. */
const MIN_ROUNDS = 3;

const LENGTH_OPTIONS: { label: string; value: NumberOfHoles | null }[] = [
  { label: '18 hoyos', value: 18 },
  { label: '9 hoyos', value: 9 },
  { label: 'Ambas', value: null },
];

interface StatCardProps {
  label: string;
  value: string;
  sample: string;
}

function StatCard({ label, value, sample }: StatCardProps) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-sample">{sample}</span>
    </div>
  );
}

function RoundResultLink({ label, result }: { label: string; result: RoundResult }) {
  const date = new Date(result.date).toLocaleDateString('es-ES');
  return (
    <Link to={`/round/${result.roundId}/summary`} className="summary-row">
      <span>
        <span className="stat-label">{label}</span>
        <br />
        <strong>{result.courseName}</strong>
        <br />
        <span className="muted">{date}</span>
      </span>
      <span>
        <strong>
          {result.totalScore} ({formatToPar(result.scoreToPar)})
        </strong>
      </span>
    </Link>
  );
}

function FinishedRoundRow({ data }: { data: RoundWithHoles }) {
  const { round, holes } = data;
  const stats = calculateRoundStats(holes);
  const date = new Date(round.date).toLocaleDateString('es-ES');
  const scoreText =
    stats.holesPlayed > 0 ? `${stats.totalScore} (${formatToPar(stats.scoreToPar)})` : 'Sin score';

  return (
    <Link to={`/round/${round.id}/summary`} className="summary-row">
      <span>
        <strong>{round.courseName}</strong>
        <br />
        <span className="muted">
          {date} · {round.tee}
        </span>
      </span>
      <span>
        <strong>{scoreText}</strong>
        <br />
        <span className="muted">
          {stats.holesPlayed}/{round.numberOfHoles} hoyos
        </span>
      </span>
    </Link>
  );
}

export function Stats() {
  const {
    loadState,
    filter,
    setCourseId,
    setNumberOfHoles,
    courses,
    stats,
    finishedRounds,
    allRounds,
  } = useStats();
  const { nudge, lastBackupAt } = useBackupNudge(allRounds);
  const { roundLevel, holes } = stats;

  const hasAnyFinishedRound = courses.length > 0;
  const hasRoundLevelData = roundLevel !== null && roundLevel.rounds > 0;

  return (
    <div className="screen stats-screen">
      <header>
        <h1 className="title">Estadísticas</h1>
      </header>

      {loadState === 'loading' && <p className="muted">Cargando…</p>}

      {loadState === 'error' && (
        <p role="alert" className="error">
          No se pudieron leer las rondas guardadas.
        </p>
      )}

      {loadState === 'ready' && !hasAnyFinishedRound && (
        <div className="card">
          <strong>Todavía no hay rondas finalizadas.</strong>
          <span className="muted">
            Las estadísticas aparecerán cuando finalices tu primera ronda. Las rondas en curso no
            cuentan.
          </span>
        </div>
      )}

      {loadState === 'ready' && hasAnyFinishedRound && (
        <>
          <BackupNudge nudge={nudge} />

          <section className="stats-filters" aria-label="Filtros">
            <div>
              <label className="field-label" htmlFor="stats-course">
                Campo
              </label>
              <select
                id="stats-course"
                className="select"
                value={filter.courseId ?? ''}
                onChange={(event) =>
                  setCourseId(event.target.value === '' ? null : event.target.value)
                }
              >
                <option value="">Todos los campos</option>
                {courses.map((course) => (
                  <option key={course.courseId} value={course.courseId}>
                    {course.courseName} ({course.rounds})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="field-label" id="stats-length-label">
                Longitud de ronda
              </span>
              <div className="segmented" role="group" aria-labelledby="stats-length-label">
                {LENGTH_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className="option"
                    aria-pressed={filter.numberOfHoles === option.value}
                    onClick={() => setNumberOfHoles(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {stats.finishedRounds === 0 && (
            <div className="card">
              <strong>No hay rondas finalizadas con este filtro.</strong>
              <span className="muted">Prueba con otro campo o con otra longitud de ronda.</span>
            </div>
          )}

          {stats.finishedRounds > 0 && (
            <>
              {stats.finishedRounds < MIN_ROUNDS && (
                <section className="warning" role="note">
                  <strong>Pocas rondas: las cifras no son concluyentes.</strong>
                  <span>
                    Hay {plural(stats.finishedRounds, 'ronda finalizada', 'rondas finalizadas')}{' '}
                    con este filtro.
                  </span>
                </section>
              )}

              <CollapsibleSection title="Resumen" defaultOpen>
                <div className="stats-grid">
                  <StatCard
                    label="Rondas finalizadas"
                    value={String(stats.finishedRounds)}
                    sample="con el filtro actual"
                  />
                  {roundLevel !== null && hasRoundLevelData && (
                    <>
                      <StatCard
                        label="Score medio"
                        value={formatDecimal(roundLevel.averageScore)}
                        sample={plural(roundLevel.rounds, 'ronda completa', 'rondas completas')}
                      />
                      <StatCard
                        label="Sobre par medio"
                        value={formatSignedDecimal(roundLevel.averageScoreToPar)}
                        sample={plural(roundLevel.rounds, 'ronda completa', 'rondas completas')}
                      />
                      <StatCard
                        label="Putts por ronda"
                        value={formatDecimal(roundLevel.averagePutts)}
                        sample={plural(roundLevel.rounds, 'ronda completa', 'rondas completas')}
                      />
                    </>
                  )}
                </div>

                {roundLevel === null && (
                  <div className="card">
                    <strong>Elige 9 o 18 hoyos para ver las cifras por ronda.</strong>
                    <span className="muted">
                      Score medio, mejor y peor ronda no se calculan mezclando rondas de 9 y de 18
                      hoyos.
                    </span>
                  </div>
                )}

                {roundLevel !== null && !hasRoundLevelData && (
                  <div className="card">
                    <strong>Aún no hay rondas completas de {roundLevel.numberOfHoles} hoyos.</strong>
                    <span className="muted">
                      Las rondas con hoyos sin jugar no cuentan en las cifras por ronda, pero sí en
                      las cifras por hoyo.
                    </span>
                  </div>
                )}

                {roundLevel !== null && hasRoundLevelData && (
                  <>
                    <h3 className="subtitle">Mejor y peor ronda</h3>
                    {roundLevel.rounds >= 2 && roundLevel.best && roundLevel.worst ? (
                      <div className="best-worst">
                        <RoundResultLink label="Mejor ronda" result={roundLevel.best} />
                        <RoundResultLink label="Peor ronda" result={roundLevel.worst} />
                      </div>
                    ) : (
                      <p className="muted">
                        Hacen falta al menos 2 rondas completas para comparar la mejor y la peor.
                      </p>
                    )}
                  </>
                )}

                <h3 className="subtitle">Por hoyo</h3>
                <div className="stats-grid">
                  <StatCard
                    label="Greens en regulación"
                    value={formatPercentage(holes.gir.percentage)}
                    sample={plural(holes.gir.total, 'hoyo', 'hoyos')}
                  />
                  <StatCard
                    label="Calles"
                    value={formatPercentage(holes.fairways.percentage)}
                    sample={plural(holes.fairways.total, 'hoyo', 'hoyos')}
                  />
                  <StatCard
                    label="Up & down"
                    value={formatPercentage(holes.upAndDown.percentage)}
                    sample={plural(holes.upAndDown.total, 'intento', 'intentos')}
                  />
                  <StatCard
                    label="3 putts por hoyo"
                    value={formatDecimal(holes.threePutts.perHole, 2)}
                    sample={`${holes.threePutts.count} en ${plural(holes.threePutts.holes, 'hoyo', 'hoyos')}`}
                  />
                  <StatCard
                    label="Penalizaciones por hoyo"
                    value={formatDecimal(holes.penalties.perHole, 2)}
                    sample={`${holes.penalties.count} en ${plural(holes.penalties.holes, 'hoyo', 'hoyos')}`}
                  />
                </div>
                <p className="muted">
                  Basado en {plural(holes.rounds, 'ronda finalizada', 'rondas finalizadas')} y{' '}
                  {plural(holes.holes, 'hoyo jugado', 'hoyos jugados')}.
                </p>

                <BackupLine lastBackupAt={lastBackupAt} />
              </CollapsibleSection>

              <CollapsibleSection title="Evolución" defaultOpen>
                {roundLevel === null ? (
                  <div className="card">
                    <strong>Elige 9 o 18 hoyos para ver la evolución.</strong>
                    <span className="muted">
                      La gráfica compara rondas de la misma longitud.
                    </span>
                  </div>
                ) : (
                  <ScoreToParChart results={roundLevel.results} />
                )}
              </CollapsibleSection>

              <CollapsibleSection title="Dónde pierdo golpes" defaultOpen>
                <LossBreakdowns stats={stats} />
              </CollapsibleSection>

              <CollapsibleSection title="Rondas finalizadas" hint={String(finishedRounds.length)}>
                <div className="round-list">
                  {finishedRounds.map((data) => (
                    <FinishedRoundRow key={data.round.id} data={data} />
                  ))}
                </div>
              </CollapsibleSection>
            </>
          )}
        </>
      )}

      <BigLink to="/rounds" variant="secondary">
        Mis rondas
      </BigLink>
      <BigLink to="/" variant="secondary">
        Inicio
      </BigLink>
    </div>
  );
}