import { distanceMeters } from './gpsLog';
import type { CourseHole, GeoPoint, Landmark, LandmarkKind, Shot, ShotFix } from './types';

/**
 * Targets of a hole (green and landmarks from courses.json) and distances to them (phase 18).
 * Informational only: nothing here blocks recording a club (D37). No React, no IndexedDB.
 */

export type HoleTargetKind = 'green' | LandmarkKind;

export interface HoleTarget {
  /** Stable within the hole: "green" or "<kind>-<index in the landmarks array>". */
  id: string;
  kind: HoleTargetKind;
  /** Spanish label for the selector chips. Unique within the hole. */
  label: string;
  point: GeoPoint;
}

const KIND_LABEL: Record<LandmarkKind, string> = {
  dogleg: 'Dogleg',
  water: 'Agua',
  bunker: 'Bunker',
  testero: 'Testero',
};

/** "Dogleg 1", "Agua (río)", "Bunker derecha", "Testero". */
function landmarkLabel(landmark: Landmark): string {
  const base = KIND_LABEL[landmark.kind];
  const extra = landmark.label?.trim();
  if (!extra) return base;
  return landmark.kind === 'water' ? `${base} (${extra})` : `${base} ${extra}`;
}

/**
 * Green first, then the landmarks in the order of courses.json. A hole without geometry gives
 * an empty list. If two landmarks end up with the same label (for example two unlabeled
 * bunkers) a number is appended so the chips can be told apart.
 */
export function buildHoleTargets(hole: CourseHole | undefined): HoleTarget[] {
  if (!hole) return [];

  const targets: HoleTarget[] = [];

  if (hole.green) {
    targets.push({
      id: 'green',
      kind: 'green',
      label: 'Green',
      point: { latitude: hole.green.latitude, longitude: hole.green.longitude },
    });
  }

  const landmarks = hole.landmarks ?? [];
  const labels = landmarks.map(landmarkLabel);

  const totals = new Map<string, number>();
  for (const label of labels) totals.set(label, (totals.get(label) ?? 0) + 1);

  const seen = new Map<string, number>();
  landmarks.forEach((landmark, index) => {
    let label = labels[index];
    if ((totals.get(label) ?? 0) > 1) {
      const n = (seen.get(label) ?? 0) + 1;
      seen.set(label, n);
      label = `${label} ${n}`;
    }
    targets.push({
      id: `${landmark.kind}-${index}`,
      kind: landmark.kind,
      label,
      point: { latitude: landmark.latitude, longitude: landmark.longitude },
    });
  });

  return targets;
}

/** The green when the hole has one, otherwise the first target, otherwise null. */
export function defaultTargetId(targets: readonly HoleTarget[]): string | null {
  return targets.find((target) => target.kind === 'green')?.id ?? targets[0]?.id ?? null;
}

/** The selected target, or the default one when the id is missing or unknown. */
export function resolveTarget(
  targets: readonly HoleTarget[],
  selectedId: string | null,
): HoleTarget | null {
  const selected = targets.find((target) => target.id === selectedId);
  if (selected) return selected;
  const fallbackId = defaultTargetId(targets);
  return targets.find((target) => target.id === fallbackId) ?? null;
}

export function greenTarget(targets: readonly HoleTarget[]): HoleTarget | null {
  return targets.find((target) => target.kind === 'green') ?? null;
}

// ---------------------------------------------------------------------------
// Distances
// ---------------------------------------------------------------------------

export interface TargetDistance {
  meters: number;
  /** Accuracy of the position. The targets are measured on a satellite map and add a few meters (D51). */
  uncertaintyM: number;
  /** The position is best effort and not fresh (D39, same rule as D57). */
  approximate: boolean;
}

/** Straight-line distance from a position to a target. */
export function distanceToTarget(fix: ShotFix, target: GeoPoint): TargetDistance {
  return {
    meters: distanceMeters(fix, target),
    uncertaintyM: fix.accuracy,
    approximate: !fix.fresh,
  };
}

/**
 * Distance to the center of the green at the moment of a shot, derived from the shot fix and
 * courses.json (D64). Never stored. Null without a fix or without a green.
 */
export function distanceToGreenAtShot(
  shot: Pick<Shot, 'fix'>,
  hole: CourseHole | undefined,
): TargetDistance | null {
  if (!shot.fix || !hole?.green) return null;
  return distanceToTarget(shot.fix, hole.green);
}

/** "148 m ± 6" or "148 m ± 6 · aprox.". */
export function formatTargetDistance(distance: TargetDistance): string {
  const text = `${Math.round(distance.meters)} m ± ${Math.round(distance.uncertaintyM)}`;
  return distance.approximate ? `${text} · aprox.` : text;
}

// ---------------------------------------------------------------------------
// Position age
// ---------------------------------------------------------------------------

/** After this the live position is dimmed and the panel asks to refresh. */
export const LIVE_FIX_STALE_MS = 60_000;

/** Age of a fix at `nowMs`. Never negative (clock jitter); Infinity for an invalid date. */
export function fixAgeMsAt(fix: Pick<ShotFix, 'fixedAt'>, nowMs: number): number {
  const fixedMs = Date.parse(fix.fixedAt);
  if (Number.isNaN(fixedMs)) return Number.POSITIVE_INFINITY;
  return Math.max(0, nowMs - fixedMs);
}

export function isLiveFixStale(ageMs: number): boolean {
  return ageMs >= LIVE_FIX_STALE_MS;
}

/** "ahora", "hace 12 s", "hace 2 min", "hace 1 h". */
export function formatFixAge(ageMs: number): string {
  if (!Number.isFinite(ageMs)) return 'hace tiempo';
  if (ageMs < 5_000) return 'ahora';
  if (ageMs < 60_000) return `hace ${Math.floor(ageMs / 1000)} s`;
  if (ageMs < 3_600_000) return `hace ${Math.floor(ageMs / 60_000)} min`;
  return `hace ${Math.floor(ageMs / 3_600_000)} h`;
}

/**
 * The most recent of several positions (the panel's own capture and the last shot fix).
 * On a tie in time the more accurate one wins. Null when there is none.
 */
export function newestFix(fixes: readonly (ShotFix | null | undefined)[]): ShotFix | null {
  let best: ShotFix | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;

  for (const fix of fixes) {
    if (!fix) continue;
    const ms = Date.parse(fix.fixedAt);
    if (Number.isNaN(ms)) continue;
    if (best === null || ms > bestMs || (ms === bestMs && fix.accuracy < best.accuracy)) {
      best = fix;
      bestMs = ms;
    }
  }
  return best;
}