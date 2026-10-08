/**
 * When to remind the user to save a backup (decision D28, values in D39).
 * Pure: the caller provides the rounds, the last backup date and "now".
 */

/** Nudge once this many finished rounds have no backup. */
export const NUDGE_MIN_UNPROTECTED_ROUNDS = 3;
/** Nudge when the last backup is this many days old and at least one round has no backup. */
export const NUDGE_MAX_DAYS = 30;

const MS_PER_DAY = 86_400_000;

export type NudgeReason = 'never' | 'rounds' | 'days';

/** The only fields of a round the nudge needs. A `Round` fits. */
export interface NudgeRound {
  status: 'in_progress' | 'finished';
  updatedAt: string;
}

export interface BackupNudge {
  show: boolean;
  reason: NudgeReason | null;
  /** Finished rounds created or edited after the last backup (all of them if never backed up). */
  unprotectedRounds: number;
  /** Whole days since the last backup, or null if there is none. */
  daysSinceBackup: number | null;
  /** The last backup date if it is valid, otherwise null. */
  lastBackupAt: string | null;
}

/**
 * - Never backed up: nudge from the first finished round.
 * - Otherwise: nudge at 3 unprotected finished rounds, or at 30 days with at least 1.
 * In-progress rounds are ignored. A round edited after the last backup counts as unprotected (D15).
 */
export function evaluateBackupNudge(
  rounds: readonly NudgeRound[],
  lastBackupAt: string | null,
  now: string,
): BackupNudge {
  const backupMs = lastBackupAt === null ? Number.NaN : Date.parse(lastBackupAt);
  const hasBackup = !Number.isNaN(backupMs);
  const nowMs = Date.parse(now);

  const finished = rounds.filter((round) => round.status === 'finished');
  const unprotectedRounds = hasBackup
    ? finished.filter((round) => Date.parse(round.updatedAt) > backupMs).length
    : finished.length;

  const daysSinceBackup =
    hasBackup && !Number.isNaN(nowMs)
      ? Math.max(0, Math.floor((nowMs - backupMs) / MS_PER_DAY))
      : null;

  let reason: NudgeReason | null = null;
  if (!hasBackup) {
    if (unprotectedRounds >= 1) reason = 'never';
  } else if (unprotectedRounds >= NUDGE_MIN_UNPROTECTED_ROUNDS) {
    reason = 'rounds';
  } else if (unprotectedRounds >= 1 && daysSinceBackup !== null && daysSinceBackup >= NUDGE_MAX_DAYS) {
    reason = 'days';
  }

  return {
    show: reason !== null,
    reason,
    unprotectedRounds,
    daysSinceBackup,
    lastBackupAt: hasBackup ? lastBackupAt : null,
  };
}