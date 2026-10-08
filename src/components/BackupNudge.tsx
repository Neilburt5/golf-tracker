import type { BackupNudge as BackupNudgeState } from '../domain/backupNudge';
import { formatShortDate, plural } from '../domain/format';
import { BigLink } from './BigButton';

function roundsWithoutBackup(count: number): string {
  return `${plural(count, 'ronda finalizada', 'rondas finalizadas')} sin copia de seguridad`;
}

/** Yellow reminder with a link to /rounds. Never blocks anything. Renders nothing when not needed. */
export function BackupNudge({ nudge }: { nudge: BackupNudgeState }) {
  if (!nudge.show || nudge.reason === null) return null;

  const lastDate = nudge.lastBackupAt ? formatShortDate(nudge.lastBackupAt) : '';
  let title: string;
  let detail: string;

  switch (nudge.reason) {
    case 'never':
      title = 'Aún no tienes ninguna copia de seguridad.';
      detail = `${roundsWithoutBackup(nudge.unprotectedRounds)}. Tus datos solo viven en este dispositivo.`;
      break;
    case 'rounds':
      title = 'Toca guardar una copia de seguridad.';
      detail = `${roundsWithoutBackup(nudge.unprotectedRounds)} desde el ${lastDate}.`;
      break;
    case 'days':
      title = 'Hace tiempo que no guardas una copia.';
      detail =
        `Última copia hace ${plural(nudge.daysSinceBackup ?? 0, 'día', 'días')} (${lastDate}); ` +
        `${roundsWithoutBackup(nudge.unprotectedRounds)}.`;
      break;
  }

  return (
    <section className="warning" role="note" aria-label="Copia de seguridad">
      <strong>{title}</strong>
      <span>{detail}</span>
      <BigLink to="/rounds" variant="secondary">
        Ir a Mis rondas
      </BigLink>
    </section>
  );
}

/** "Última copia: 3 oct 2026" or a note that there is none. */
export function BackupLine({ lastBackupAt }: { lastBackupAt: string | null }) {
  return (
    <p className="muted">
      {lastBackupAt
        ? `Última copia: ${formatShortDate(lastBackupAt)}`
        : 'Todavía no has guardado ninguna copia.'}
    </p>
  );
}