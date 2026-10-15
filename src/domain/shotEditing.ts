import type { ClubCode } from './clubs';
import type { ShotFix, ShotInput } from './types';

/**
 * Pure list operations for the shots of ONE hole (phase 17). They work on `ShotInput[]`,
 * the shape `saveHoleShots` replaces as a whole; `sequence` is assigned later from the array
 * order. Nothing here mutates its input.
 */

/** A new shot: the club is known at the tap, the position arrives later (attachFix). */
export function createShotInput(id: string, club: ClubCode, createdAt: string): ShotInput {
  return { id, club, fix: null, createdAt };
}

/** New shots are always added at the end. */
export function appendShot(shots: readonly ShotInput[], shot: ShotInput): ShotInput[] {
  return [...shots, shot];
}

export function changeClub(shots: readonly ShotInput[], id: string, club: ClubCode): ShotInput[] {
  return shots.map((shot) => (shot.id === id ? { ...shot, club } : shot));
}

export function removeShot(shots: readonly ShotInput[], id: string): ShotInput[] {
  return shots.filter((shot) => shot.id !== id);
}

/**
 * Attaches the position of a finished capture. If the shot was deleted in the meantime
 * the list is returned unchanged, so a late capture can never bring a shot back.
 */
export function attachFix(shots: readonly ShotInput[], id: string, fix: ShotFix): ShotInput[] {
  return shots.map((shot) => (shot.id === id ? { ...shot, fix } : shot));
}