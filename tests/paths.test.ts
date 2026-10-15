import { describe, expect, it } from 'vitest';
import { roundHolePath, roundShotsPath, roundSummaryPath } from '../src/domain/paths';

describe('paths', () => {
  it('builds the round routes', () => {
    expect(roundHolePath('abc', 3)).toBe('/round/abc/hole/3');
    expect(roundShotsPath('abc', 3)).toBe('/round/abc/hole/3/shots');
    expect(roundSummaryPath('abc')).toBe('/round/abc/summary');
  });
});