import { describe, expect, it } from 'vitest';
import {
  LIVE_FIX_STALE_MS,
  buildHoleTargets,
  defaultTargetId,
  distanceToGreenAtShot,
  distanceToTarget,
  fixAgeMsAt,
  formatFixAge,
  formatTargetDistance,
  greenTarget,
  isLiveFixStale,
  newestFix,
  resolveTarget,
} from '../src/domain/holeTargets';
import type { CourseHole, ShotFix } from '../src/domain/types';

function fix(overrides: Partial<ShotFix> = {}): ShotFix {
  return {
    latitude: 40.6,
    longitude: -3.47,
    accuracy: 5,
    fixedAt: '2026-10-15T10:00:00.000Z',
    fresh: true,
    ...overrides,
  };
}

const hole7: CourseHole = {
  number: 7,
  par: 5,
  green: { latitude: 40.612708, longitude: -3.467225 },
  landmarks: [
    { kind: 'dogleg', label: '1', latitude: 40.612294, longitude: -3.464167 },
    { kind: 'dogleg', label: '2', latitude: 40.612999, longitude: -3.465998 },
  ],
};

const hole6: CourseHole = {
  number: 6,
  par: 4,
  green: { latitude: 40.61016, longitude: -3.462783 },
  landmarks: [
    { kind: 'bunker', latitude: 40.609165, longitude: -3.462622 },
    { kind: 'water', label: 'río', latitude: 40.609729, longitude: -3.462759 },
  ],
};

const hole4: CourseHole = {
  number: 4,
  par: 4,
  green: { latitude: 40.607539, longitude: -3.463635 },
  landmarks: [
    { kind: 'bunker', label: 'derecha', latitude: 40.606348, longitude: -3.46469 },
    { kind: 'bunker', label: 'izquierda', latitude: 40.606633, longitude: -3.464899 },
  ],
};

const hole5: CourseHole = {
  number: 5,
  par: 4,
  green: { latitude: 40.606965, longitude: -3.460514 },
  landmarks: [{ kind: 'testero', latitude: 40.607259, longitude: -3.461289 }],
};

describe('buildHoleTargets', () => {
  it('is empty for a hole without geometry or without a hole', () => {
    expect(buildHoleTargets({ number: 2, par: 3 })).toEqual([]);
    expect(buildHoleTargets(undefined)).toEqual([]);
  });

  it('puts the green first, then the landmarks in file order', () => {
    const targets = buildHoleTargets(hole6);
    expect(targets.map((t) => t.label)).toEqual(['Green', 'Bunker', 'Agua (río)']);
    expect(targets.map((t) => t.kind)).toEqual(['green', 'bunker', 'water']);
    expect(targets.map((t) => t.id)).toEqual(['green', 'bunker-0', 'water-1']);
  });

  it('labels the two doglegs of hole 7', () => {
    expect(buildHoleTargets(hole7).map((t) => t.label)).toEqual(['Green', 'Dogleg 1', 'Dogleg 2']);
  });

  it('labels bunkers by side and a testero', () => {
    expect(buildHoleTargets(hole4).map((t) => t.label)).toEqual([
      'Green',
      'Bunker derecha',
      'Bunker izquierda',
    ]);
    expect(buildHoleTargets(hole5).map((t) => t.label)).toEqual(['Green', 'Testero']);
  });

  it('numbers landmarks that would otherwise share a label', () => {
    const hole: CourseHole = {
      number: 1,
      par: 4,
      landmarks: [
        { kind: 'bunker', latitude: 40.6, longitude: -3.47 },
        { kind: 'bunker', latitude: 40.601, longitude: -3.47 },
        { kind: 'water', latitude: 40.602, longitude: -3.47 },
      ],
    };
    expect(buildHoleTargets(hole).map((t) => t.label)).toEqual(['Bunker 1', 'Bunker 2', 'Agua']);
  });

  it('works for a hole with landmarks but no green', () => {
    const hole: CourseHole = {
      number: 1,
      par: 4,
      landmarks: [{ kind: 'dogleg', latitude: 40.6, longitude: -3.47 }],
    };
    const targets = buildHoleTargets(hole);
    expect(targets).toHaveLength(1);
    expect(greenTarget(targets)).toBeNull();
  });

  it('copies only latitude and longitude into the point', () => {
    const [green] = buildHoleTargets(hole6);
    expect(green.point).toEqual({ latitude: 40.61016, longitude: -3.462783 });
  });
});

describe('defaultTargetId and resolveTarget', () => {
  it('defaults to the green', () => {
    expect(defaultTargetId(buildHoleTargets(hole6))).toBe('green');
  });

  it('defaults to the first target when there is no green', () => {
    const targets = buildHoleTargets({
      number: 1,
      par: 4,
      landmarks: [{ kind: 'water', latitude: 40.6, longitude: -3.47 }],
    });
    expect(defaultTargetId(targets)).toBe('water-0');
  });

  it('is null without targets', () => {
    expect(defaultTargetId([])).toBeNull();
    expect(resolveTarget([], null)).toBeNull();
  });

  it('resolves the selected target or falls back to the default', () => {
    const targets = buildHoleTargets(hole6);
    expect(resolveTarget(targets, 'water-1')?.label).toBe('Agua (río)');
    expect(resolveTarget(targets, 'bunker-9')?.id).toBe('green');
    expect(resolveTarget(targets, null)?.id).toBe('green');
  });
});

describe('distanceToTarget', () => {
  // 0.001 degrees of latitude is about 111.2 m
  const target = { latitude: 40.601, longitude: -3.47 };

  it('is the straight-line distance with the fix accuracy as uncertainty', () => {
    const result = distanceToTarget(fix({ accuracy: 5 }), target);
    expect(result.meters).toBeCloseTo(111.2, 0);
    expect(result.uncertaintyM).toBe(5);
    expect(result.approximate).toBe(false);
  });

  it('is approximate when the fix is not fresh', () => {
    expect(distanceToTarget(fix({ fresh: false }), target).approximate).toBe(true);
  });
});

describe('distanceToGreenAtShot (D64)', () => {
   it('derives the distance from the shot fix and the green', () => {
    // Same longitude as the green, 0.001 degrees of latitude to the south: about 111.2 m.
    const result = distanceToGreenAtShot(
      { fix: fix({ latitude: 40.611708, longitude: -3.467225 }) },
      hole7,
    );
    expect(result?.meters).toBeCloseTo(111.2, 0);
  });

  it('is null without a fix or without a green', () => {
    expect(distanceToGreenAtShot({ fix: null }, hole7)).toBeNull();
    expect(distanceToGreenAtShot({ fix: fix() }, { number: 2, par: 3 })).toBeNull();
    expect(distanceToGreenAtShot({ fix: fix() }, undefined)).toBeNull();
  });
});

describe('formatTargetDistance', () => {
  it('rounds meters and uncertainty', () => {
    expect(formatTargetDistance({ meters: 148.4, uncertaintyM: 5.6, approximate: false })).toBe(
      '148 m ± 6',
    );
  });

  it('marks approximate distances', () => {
    expect(formatTargetDistance({ meters: 90, uncertaintyM: 18, approximate: true })).toBe(
      '90 m ± 18 · aprox.',
    );
  });
});

describe('position age', () => {
  const fixedAt = '2026-10-15T10:00:00.000Z';
  const base = Date.parse(fixedAt);

  it('computes the age and never returns a negative one', () => {
    expect(fixAgeMsAt({ fixedAt }, base + 12_000)).toBe(12_000);
    expect(fixAgeMsAt({ fixedAt }, base - 5_000)).toBe(0);
  });

  it('is infinite for an invalid date', () => {
    expect(fixAgeMsAt({ fixedAt: 'nope' }, base)).toBe(Number.POSITIVE_INFINITY);
  });

  it('is stale from 60 s on', () => {
    expect(LIVE_FIX_STALE_MS).toBe(60_000);
    expect(isLiveFixStale(59_999)).toBe(false);
    expect(isLiveFixStale(60_000)).toBe(true);
    expect(isLiveFixStale(Number.POSITIVE_INFINITY)).toBe(true);
  });

  it('formats the age in Spanish', () => {
    expect(formatFixAge(0)).toBe('ahora');
    expect(formatFixAge(4_999)).toBe('ahora');
    expect(formatFixAge(12_000)).toBe('hace 12 s');
    expect(formatFixAge(59_900)).toBe('hace 59 s');
    expect(formatFixAge(60_000)).toBe('hace 1 min');
    expect(formatFixAge(125_000)).toBe('hace 2 min');
    expect(formatFixAge(3_600_000)).toBe('hace 1 h');
    expect(formatFixAge(Number.POSITIVE_INFINITY)).toBe('hace tiempo');
  });
});

describe('newestFix', () => {
  const older = fix({ fixedAt: '2026-10-15T10:00:00.000Z', accuracy: 3 });
  const newer = fix({ fixedAt: '2026-10-15T10:00:30.000Z', accuracy: 12 });

  it('picks the most recent position, not the most accurate', () => {
    expect(newestFix([older, newer])).toBe(newer);
    expect(newestFix([newer, older])).toBe(newer);
  });

  it('ignores null, undefined and invalid dates', () => {
    expect(newestFix([null, undefined, fix({ fixedAt: 'bad' }), older])).toBe(older);
  });

  it('breaks a tie in time with the better accuracy', () => {
    const a = fix({ accuracy: 10 });
    const b = fix({ accuracy: 4 });
    expect(newestFix([a, b])).toBe(b);
  });

  it('is null when there is nothing', () => {
    expect(newestFix([])).toBeNull();
    expect(newestFix([null, undefined])).toBeNull();
  });
});