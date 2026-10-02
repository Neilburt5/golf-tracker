import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BigButton, BigLink } from '../components/BigButton';
import { calculateRoundStats, holeScoreToPar, unplayedHoles } from '../domain/calculations';
import { formatPercentage, formatToPar } from '../domain/format';
import { useRoundSummary } from '../hooks/useRoundSummary';

function StatCell({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {detail && <span className="muted">{detail}</span>}
    </div>
  );
}

function holesWithoutScoreText(count: number): string {
  return count === 1 ? '1 hoyo sin score' : `${count} hoyos sin score`;
}

export function RoundSummary() {
  const { roundId = '' } = useParams();
  const summary = useRoundSummary(roundId);
  const [confirming, setConfirming] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishFailed, setFinishFailed] = useState(false);

  const { round, holes } = summary;

  if (summary.loadState === 'loading') {
    return (
      <div className="screen">
        <p className="muted">Cargando…</p>
      </div>
    );
  }

  if (summary.loadState === 'error') {
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

  if (summary.loadState === 'not_found' || !round) {
    return (
      <div className="screen">
        <h1 className="title">No encontrado</h1>
        <p className="muted">Esta ronda no existe.</p>
        <BigLink to="/" variant="secondary">
          Inicio
        </BigLink>
      </div>
    );
  }

  const stats = calculateRoundStats(holes);
  const missing = unplayedHoles(holes);
  const isFinished = round.status === 'finished';
  const holePath = (n: number) => `/round/${round.id}/hole/${n}`;
  const date = new Date(round.date).toLocaleDateString('es-ES');
  const toPar = stats.holesPlayed > 0 ? formatToPar(stats.scoreToPar) : undefined;

  const handleConfirm = async () => {
    setFinishing(true);
    setFinishFailed(false);
    const ok = await summary.finish();
    setFinishing(false);
    if (ok) {
      setConfirming(false);
    } else {
      setFinishFailed(true);
    }
  };

  return (
    <div className="screen">
      <header>
        <h1 className="title">Resumen</h1>
        <p className="muted">
          {round.courseName} · {round.tee} · {date}
        </p>
        {isFinished && <p className="badge">Ronda finalizada ✓</p>}
      </header>

      {missing.length > 0 && (
        <section className="warning" role="alert">
          <strong>{holesWithoutScoreText(missing.length)}</strong>
          <p className="muted">No cuentan en las estadísticas hasta que les pongas score:</p>
          <div className="chip-row">
            {missing.map((h) => (
              <Link key={h.id} to={holePath(h.holeNumber)} className="chip">
                Hoyo {h.holeNumber}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="stat-grid" aria-label="Estadísticas">
        <StatCell
          label="Score"
          value={stats.holesPlayed > 0 ? String(stats.totalScore) : '—'}
          detail={toPar}
        />
        <StatCell label="Putts" value={String(stats.totalPutts)} />
        <StatCell
          label="Calles"
          value={`${stats.fairwaysHit} / ${stats.fairwayOpportunities}`}
        />
        <StatCell
          label="GIR"
          value={`${stats.girCount} / ${stats.holesPlayed}`}
          detail={formatPercentage(stats.girPercentage)}
        />
        <StatCell label="3 putts" value={String(stats.threePutts)} />
        <StatCell label="Penalizaciones" value={String(stats.penaltyStrokes)} />
        <StatCell label="Bunkers" value={String(stats.bunkers)} />
        <StatCell
          label="Up & down"
          value={`${stats.upAndDownMade} / ${stats.upAndDownAttempts}`}
          detail={formatPercentage(stats.upAndDownPercentage)}
        />
      </section>

      <section>
        <h2 className="subtitle">Hoyos (toca para corregir)</h2>
        <div className="stack">
          {holes.map((h) => (
            <Link key={h.id} to={holePath(h.holeNumber)} className="summary-row">
              <span>
                <strong>Hoyo {h.holeNumber}</strong> <span className="muted">Par {h.par}</span>
              </span>
              <span>
                {h.score === null ? (
                  <span className="muted">Sin score</span>
                ) : (
                  <>
                    <strong>{h.score}</strong>{' '}
                    <span className="muted">
                      {formatToPar(holeScoreToPar(h))} · {h.putts} putts
                    </span>
                  </>
                )}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="actions">
        {!isFinished && !confirming && (
          <BigButton onClick={() => setConfirming(true)}>Finalizar ronda</BigButton>
        )}

        {!isFinished && confirming && (
          <section className="warning">
            <strong>¿Finalizar la ronda?</strong>
            <p className="muted">
              {missing.length > 0
                ? `Hay ${holesWithoutScoreText(missing.length)}; se finalizará igualmente y no contarán en las estadísticas. `
                : ''}
              Podrás seguir corrigiendo hoyos después.
            </p>
            {finishFailed && (
              <p className="error" role="alert">
                No se pudo finalizar. Inténtalo de nuevo.
              </p>
            )}
            <div className="actions-row">
              <BigButton variant="secondary" disabled={finishing} onClick={() => setConfirming(false)}>
                Cancelar
              </BigButton>
              <BigButton disabled={finishing} onClick={handleConfirm}>
                {finishing ? 'Finalizando…' : 'Sí, finalizar'}
              </BigButton>
            </div>
          </section>
        )}

        <BigLink to="/" variant="secondary">
          Inicio
        </BigLink>
      </div>
    </div>
  );
}