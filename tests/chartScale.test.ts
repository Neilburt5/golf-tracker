import { describe, expect, it } from 'vitest';
import {
  MIN_BAR_WIDTH,
  barSpan,
  linePoints,
  linearScale,
  niceAxis,
  pointsAttribute,
} from '../src/domain/chartScale';

describe('niceAxis', () => {
  it('includes zero and rounds the range outwards', () => {
    expect(niceAxis([0, 18, 36])).toEqual({ min: 0, max: 40, ticks: [0, 10, 20, 30, 40] });
    expect(niceAxis([-2, 5, 12])).toEqual({ min: -5, max: 15, ticks: [-5, 0, 5, 10, 15] });
  });

  it('works with decimals', () => {
    expect(niceAxis([-0.2, 1.4])).toEqual({ min: -0.5, max: 1.5, ticks: [-0.5, 0, 0.5, 1, 1.5] });
  });

  it('keeps ticks on whole numbers with minStep', () => {
    expect(niceAxis([1], 5, 1).ticks).toEqual([0, 1]);
    expect(niceAxis([1]).ticks).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('handles no values and all-zero values', () => {
    expect(niceAxis([])).toEqual({ min: 0, max: 1, ticks: [0, 1] });
    expect(niceAxis([0, 0]).max).toBeGreaterThan(niceAxis([0, 0]).min);
  });

  it('never returns -0', () => {
    const axis = niceAxis([-3, 0, 4]);
    expect(axis.ticks.every((t) => !Object.is(t, -0))).toBe(true);
  });
});

describe('linearScale', () => {
  it('maps the domain onto the range', () => {
    const scale = linearScale(0, 10, 100, 200);
    expect(scale(0)).toBe(100);
    expect(scale(5)).toBe(150);
    expect(scale(10)).toBe(200);
  });

  it('maps a degenerate domain to the middle of the range', () => {
    expect(linearScale(3, 3, 0, 100)(3)).toBe(50);
  });
});

describe('linePoints', () => {
  const axis = { min: 0, max: 10, ticks: [0, 10] };

  it('spreads points evenly and puts higher values higher up', () => {
    expect(linePoints([0, 5, 10], axis, 100, 50)).toEqual([
      { x: 0, y: 50 },
      { x: 50, y: 25 },
      { x: 100, y: 0 },
    ]);
  });

  it('centres a single point', () => {
    expect(linePoints([10], axis, 100, 50)).toEqual([{ x: 50, y: 0 }]);
  });

  it('formats the points attribute with one decimal', () => {
    expect(pointsAttribute([{ x: 1.234, y: 50 }, { x: 100, y: 0.04 }])).toBe('1.2,50 100,0');
  });
});

describe('barSpan', () => {
  const axis = { min: -1, max: 3, ticks: [-1, 0, 1, 2, 3] };

  it('draws positive bars to the right of the zero line', () => {
    expect(barSpan(2, axis, 400)).toEqual({ x: 100, width: 200, zeroX: 100 });
  });

  it('draws negative bars to the left of the zero line', () => {
    expect(barSpan(-1, axis, 400)).toEqual({ x: 0, width: 100, zeroX: 100 });
  });

  it('keeps zero and tiny values visible', () => {
    expect(barSpan(0, axis, 400)).toEqual({ x: 100, width: MIN_BAR_WIDTH, zeroX: 100 });
    expect(barSpan(-0.001, axis, 400)).toEqual({
      x: 100 - MIN_BAR_WIDTH,
      width: MIN_BAR_WIDTH,
      zeroX: 100,
    });
  });
});