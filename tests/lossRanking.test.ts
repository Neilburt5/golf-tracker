import { describe, expect, it } from 'vitest';
import { LOW_SAMPLE_HOLES, highestAverageToPar, isLowSample } from '../src/domain/lossRanking';

function group(name: string, holes: number, averageScoreToPar: number | null) {
  return { name, stats: { holes, averageScoreToPar } };
}

describe('isLowSample', () => {
  it('flags groups below the threshold', () => {
    expect(LOW_SAMPLE_HOLES).toBe(5);
    expect(isLowSample(4)).toBe(true);
    expect(isLowSample(5)).toBe(false);
  });
});

describe('highestAverageToPar', () => {
  it('picks the highest average among groups with enough holes', () => {
    const groups = [group('a', 10, 0.5), group('b', 8, 1.4), group('c', 12, 0.9)];
    expect(highestAverageToPar(groups)?.name).toBe('b');
  });

  it('ignores small samples, however high their average', () => {
    const groups = [group('tiny', 2, 3), group('ok', 6, 0.4)];
    expect(highestAverageToPar(groups)?.name).toBe('ok');
  });

  it('returns null when nothing qualifies', () => {
    expect(highestAverageToPar([])).toBeNull();
    expect(highestAverageToPar([group('tiny', 4, 2)])).toBeNull();
    expect(highestAverageToPar([group('empty', 9, null)])).toBeNull();
  });

  it('goes to the first group on a tie', () => {
    const groups = [group('first', 6, 1), group('second', 9, 1)];
    expect(highestAverageToPar(groups)?.name).toBe('first');
  });

  it('works with negative averages (all groups better than par)', () => {
    const groups = [group('a', 6, -0.5), group('b', 6, -0.1)];
    expect(highestAverageToPar(groups)?.name).toBe('b');
  });

  it('accepts a custom minimum', () => {
    expect(highestAverageToPar([group('tiny', 2, 3)], 2)?.name).toBe('tiny');
  });
});