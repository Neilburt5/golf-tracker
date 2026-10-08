import { describe, expect, it } from 'vitest';
import {
  NUDGE_MAX_DAYS,
  NUDGE_MIN_UNPROTECTED_ROUNDS,
  evaluateBackupNudge,
  type NudgeRound,
} from '../src/domain/backupNudge';

const NOW = '2026-10-08T10:00:00.000Z';
const BACKUP = '2026-10-01T10:00:00.000Z'; // 7 days before NOW

function finished(updatedAt: string): NudgeRound {
  return { status: 'finished', updatedAt };
}

function unprotected(count: number): NudgeRound[] {
  return Array.from({ length: count }, () => finished('2026-10-05T10:00:00.000Z'));
}

describe('constants', () => {
  it('match decision D39', () => {
    expect(NUDGE_MIN_UNPROTECTED_ROUNDS).toBe(3);
    expect(NUDGE_MAX_DAYS).toBe(30);
  });
});

describe('never backed up', () => {
  it('does not nudge without finished rounds', () => {
    const nudge = evaluateBackupNudge([], null, NOW);
    expect(nudge.show).toBe(false);
    expect(nudge.reason).toBeNull();
  });

  it('ignores in-progress rounds', () => {
    const rounds: NudgeRound[] = [{ status: 'in_progress', updatedAt: BACKUP }];
    expect(evaluateBackupNudge(rounds, null, NOW).show).toBe(false);
  });

  it('nudges from the first finished round', () => {
    const nudge = evaluateBackupNudge(unprotected(1), null, NOW);
    expect(nudge.show).toBe(true);
    expect(nudge.reason).toBe('never');
    expect(nudge.unprotectedRounds).toBe(1);
    expect(nudge.daysSinceBackup).toBeNull();
    expect(nudge.lastBackupAt).toBeNull();
  });

  it('treats an invalid stored date as "never"', () => {
    const nudge = evaluateBackupNudge(unprotected(1), 'garbage', NOW);
    expect(nudge.reason).toBe('never');
    expect(nudge.lastBackupAt).toBeNull();
  });
});

describe('after a backup', () => {
  it('does not nudge when every round is older than the backup', () => {
    const rounds = [finished('2026-09-20T10:00:00.000Z'), finished('2026-09-25T10:00:00.000Z')];
    const nudge = evaluateBackupNudge(rounds, BACKUP, NOW);
    expect(nudge.show).toBe(false);
    expect(nudge.unprotectedRounds).toBe(0);
    expect(nudge.daysSinceBackup).toBe(7);
    expect(nudge.lastBackupAt).toBe(BACKUP);
  });

  it('does not nudge with 2 unprotected rounds and a recent backup', () => {
    expect(evaluateBackupNudge(unprotected(2), BACKUP, NOW).show).toBe(false);
  });

  it('nudges at 3 unprotected rounds', () => {
    const nudge = evaluateBackupNudge(unprotected(3), BACKUP, NOW);
    expect(nudge.show).toBe(true);
    expect(nudge.reason).toBe('rounds');
    expect(nudge.unprotectedRounds).toBe(3);
  });

  it('counts a round edited after the backup as unprotected', () => {
    const rounds = [finished('2026-09-20T10:00:00.000Z'), finished('2026-10-03T10:00:00.000Z')];
    expect(evaluateBackupNudge(rounds, BACKUP, NOW).unprotectedRounds).toBe(1);
  });

  it('treats a round updated exactly at the backup time as protected', () => {
    expect(evaluateBackupNudge([finished(BACKUP)], BACKUP, NOW).unprotectedRounds).toBe(0);
  });

  it('ignores in-progress rounds when counting', () => {
    const rounds: NudgeRound[] = [
      ...unprotected(2),
      { status: 'in_progress', updatedAt: '2026-10-06T10:00:00.000Z' },
    ];
    expect(evaluateBackupNudge(rounds, BACKUP, NOW).show).toBe(false);
  });
});

describe('age of the backup', () => {
  it('does not nudge at 29 days', () => {
    const nudge = evaluateBackupNudge(unprotected(1), '2026-09-09T10:00:00.000Z', NOW);
    expect(nudge.daysSinceBackup).toBe(29);
    expect(nudge.show).toBe(false);
  });

  it('nudges at exactly 30 days with at least one unprotected round', () => {
    const nudge = evaluateBackupNudge(unprotected(1), '2026-09-08T10:00:00.000Z', NOW);
    expect(nudge.daysSinceBackup).toBe(30);
    expect(nudge.reason).toBe('days');
  });

  it('does not nudge when the backup is old but nothing is unprotected', () => {
    const rounds = [finished('2026-08-01T10:00:00.000Z')];
    const nudge = evaluateBackupNudge(rounds, '2026-09-01T10:00:00.000Z', NOW);
    expect(nudge.daysSinceBackup).toBe(37);
    expect(nudge.show).toBe(false);
  });

  it('reports "rounds" before "days" when both apply', () => {
    const nudge = evaluateBackupNudge(unprotected(4), '2026-08-01T10:00:00.000Z', NOW);
    expect(nudge.reason).toBe('rounds');
  });

  it('never reports negative days if the clock is behind the backup', () => {
    const nudge = evaluateBackupNudge([], '2026-10-09T10:00:00.000Z', NOW);
    expect(nudge.daysSinceBackup).toBe(0);
  });
});