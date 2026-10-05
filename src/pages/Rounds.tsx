import { useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { BigButton, BigLink } from '../components/BigButton';
import { calculateRoundStats } from '../domain/calculations';
import { formatToPar } from '../domain/format';
import type { RoundWithHoles } from '../domain/types';
import { useRounds, type RestoreOutcome } from '../hooks/useRounds';
import { createBackupFile, type BackupErrorCode, type RestoreSummary } from '../services/backup';
import { createAllRoundsExcelFile, selectRoundsForExport } from '../services/excelExport';
import { shareFile } from '../services/shareFile';

type Message = { tone: 'ok' | 'error'; text: string };

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

const BACKUP_ERRORS: Record<BackupErrorCode, string> = {
  not_json: 'El archivo no es una copia de seguridad válida.',
  wrong_app: 'Este archivo no es una copia de seguridad de Golf Tracker.',
  unsupported_version:
    'Esta copia es de una versión más nueva de la app. Actualiza la app e inténtalo de nuevo.',
  invalid_structure: 'El archivo está dañado o incompleto. No se ha importado nada.',
};

function restoreSummaryText(summary: RestoreSummary): string {
  const parts = [
    plural(summary.imported, 'ronda importada', 'rondas importadas'),
    summary.skipped === 1 ? '1 ya existía' : `${summary.skipped} ya existían`,
  ];
  if (summary.failed > 0) {
    parts.push(plural(summary.failed, 'no se pudo importar', 'no se pudieron importar'));
  }
  return parts.join(', ') + '.';
}

function restoreMessage(outcome: RestoreOutcome): Message {
  switch (outcome.kind) {
    case 'done':
      return {
        tone: outcome.summary.failed > 0 ? 'error' : 'ok',
        text: restoreSummaryText(outcome.summary),
      };
    case 'invalid':
      return { tone: 'error', text: BACKUP_ERRORS[outcome.code] };
    case 'unreadable':
      return { tone: 'error', text: 'No se pudo leer el archivo.' };
  }
}

interface RoundRowProps {
  data: RoundWithHoles;
  onDelete: (roundId: string) => Promise<boolean>;
}

function RoundRow({ data, onDelete }: RoundRowProps) {
  const { round, holes } = data;
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  const stats = calculateRoundStats(holes);
  const date = new Date(round.date).toLocaleDateString('es-ES');
  const inProgress = round.status === 'in_progress';
  const scoreText =
    stats.holesPlayed > 0
      ? `${stats.totalScore} (${formatToPar(stats.scoreToPar)})`
      : 'Sin score';

  const handleDelete = async () => {
    setDeleting(true);
    setFailed(false);
    const ok = await onDelete(round.id);
    // On success the row disappears, so there is no state left to update.
    if (!ok) {
      setDeleting(false);
      setFailed(true);
    }
  };

  return (
    <div className="stack">
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
            {inProgress ? 'En curso' : 'Finalizada'} · {stats.holesPlayed}/{round.numberOfHoles}
          </span>
        </span>
      </Link>

      {!confirming && (
        <BigButton variant="secondary" onClick={() => setConfirming(true)}>
          Eliminar
        </BigButton>
      )}

      {confirming && (
        <section className="warning">
          <strong>¿Eliminar esta ronda?</strong>
          <p className="muted">
            Se borrarán la ronda de {round.courseName} del {date} y todos sus hoyos
            {inProgress ? ' (está en curso)' : ''}. No se puede deshacer. Si dudas, guarda antes
            una copia de seguridad.
          </p>
          {failed && (
            <p className="error" role="alert">
              No se pudo eliminar. Inténtalo de nuevo.
            </p>
          )}
          <div className="actions-row">
            <BigButton variant="secondary" disabled={deleting} onClick={() => setConfirming(false)}>
              Cancelar
            </BigButton>
            <BigButton disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Eliminando…' : 'Sí, eliminar'}
            </BigButton>
          </div>
        </section>
      )}
    </div>
  );
}

export function Rounds() {
  const { loadState, rounds, remove, restore } = useRounds();
  const [message, setMessage] = useState<Message | null>(null);
  const [restoring, setRestoring] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportableCount = selectRoundsForExport(rounds).length;
  const inProgressCount = rounds.filter((r) => r.round.status === 'in_progress').length;

  // No await before shareFile: iOS only opens the share sheet while the tap is still fresh.
  const handleBackup = async () => {
    const { blob, filename } = createBackupFile(rounds.map((r) => r));
    const outcome = await shareFile(blob, filename);
    if (outcome === 'shared') setMessage({ tone: 'ok', text: 'Copia compartida.' });
    if (outcome === 'downloaded') setMessage({ tone: 'ok', text: 'Copia descargada.' });
  };

  // No await before shareFile: iOS only opens the share sheet while the tap is still fresh.
  const handleExportAll = async () => {
    const { blob, filename } = createAllRoundsExcelFile(rounds);
    const outcome = await shareFile(blob, filename);
    if (outcome === 'shared') setMessage({ tone: 'ok', text: 'Excel compartido.' });
    if (outcome === 'downloaded') setMessage({ tone: 'ok', text: 'Excel descargado.' });
  };

  const handleFileChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    setRestoring(true);
    setMessage(null);
    const outcome = await restore(file);
    setMessage(restoreMessage(outcome));
    setRestoring(false);
    input.value = ''; // lets the same file be chosen again
  };

  return (
    <div className="screen">
      <header>
        <h1 className="title">Mis rondas</h1>
      </header>

      {loadState === 'loading' && <p className="muted">Cargando…</p>}

      {loadState === 'error' && (
        <p role="alert" className="error">
          No se pudieron leer las rondas guardadas.
        </p>
      )}

      {loadState === 'ready' && rounds.length === 0 && (
        <p className="muted">Todavía no hay rondas guardadas.</p>
      )}

      {loadState === 'ready' && rounds.length > 0 && (
        <section className="stack" aria-label="Rondas">
          {rounds.map((data) => (
            <RoundRow key={data.round.id} data={data} onDelete={remove} />
          ))}
        </section>
      )}

      <section className="stack">
        <h2 className="subtitle">Excel</h2>
        <p className="muted">
          Un solo archivo con todas las rondas finalizadas ({exportableCount}).
          {inProgressCount > 0 && ` Las rondas en curso no se incluyen (${inProgressCount}).`}{' '}
          El archivo siempre se llama igual: al guardarlo en Archivos puedes elegir «Reemplazar».
        </p>
        <BigButton
          variant="secondary"
          disabled={loadState !== 'ready' || exportableCount === 0}
          onClick={handleExportAll}
        >
          Exportar todo a Excel
        </BigButton>
        {message && (
          <p role="status" className={message.tone === 'error' ? 'error' : 'badge'}>
            {message.text}
          </p>
        )}
      </section>

      <section className="stack">
        <h2 className="subtitle">Copia de seguridad</h2>
        <p className="muted">
          Guarda todas tus rondas en un archivo. Al restaurar nunca se sobrescribe nada: las rondas
          que ya existen se dejan como están.
        </p>
        <BigButton
          variant="secondary"
          disabled={loadState !== 'ready' || rounds.length === 0}
          onClick={handleBackup}
        >
          Guardar copia
        </BigButton>
        <BigButton variant="secondary" disabled={restoring} onClick={() => fileInput.current?.click()}>
          {restoring ? 'Restaurando…' : 'Restaurar copia'}
        </BigButton>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleFileChosen}
        />
        {message && (
          <p role="status" className={message.tone === 'error' ? 'error' : 'badge'}>
            {message.text}
          </p>
        )}
      </section>

      <BigLink to="/" variant="secondary">
        Inicio
      </BigLink>
    </div>
  );
}