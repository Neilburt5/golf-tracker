/**
 * Pure geometry for the SVG charts. The components only draw what these functions return.
 */

export interface Axis {
  min: number;
  max: number;
  /** Evenly spaced values from min to max, inclusive. */
  ticks: number[];
}

export interface Point {
  x: number;
  y: number;
}

export interface BarSpan {
  /** Left edge of the bar. */
  x: number;
  width: number;
  /** Position of the zero line. */
  zeroX: number;
}

/** A bar for a non-null value is never thinner than this, so it stays visible. */
export const MIN_BAR_WIDTH = 2;

const STEPS = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100];

function snap(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function clean(value: number): number {
  return Math.round(value * 1000) / 1000 || 0; // `|| 0` turns -0 into 0
}

/**
 * A readable axis that always includes zero. `minStep` keeps ticks on whole numbers
 * for integer data (e.g. score to par).
 */
export function niceAxis(values: readonly number[], approxTicks = 5, minStep = 0): Axis {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo;
  const rawStep = span === 0 ? 1 : span / Math.max(approxTicks - 1, 1);
  const wanted = Math.max(rawStep, minStep);
  const step = STEPS.find((s) => s >= wanted) ?? Math.ceil(wanted / 100) * 100;

  const min = clean(Math.floor(snap(lo / step)) * step);
  let max = clean(Math.ceil(snap(hi / step)) * step);
  if (max === min) max = clean(min + step);

  const ticks: number[] = [];
  for (let i = 0; min + i * step <= max + step * 1e-6; i++) {
    ticks.push(clean(min + i * step));
  }
  return { min, max, ticks };
}

/** Maps a domain value to a range value. A degenerate domain maps to the middle of the range. */
export function linearScale(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
): (value: number) => number {
  if (domainMin === domainMax) return () => (rangeMin + rangeMax) / 2;
  return (value) =>
    rangeMin + ((value - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
}

/** One point per value, evenly spaced from 0 to `width`; higher values are higher up. */
export function linePoints(
  values: readonly number[],
  axis: Axis,
  width: number,
  height: number,
): Point[] {
  const y = linearScale(axis.min, axis.max, height, 0);
  return values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
    y: y(value),
  }));
}

/** SVG `points` attribute, one decimal. */
export function pointsAttribute(points: readonly Point[]): string {
  const round = (v: number) => Math.round(v * 10) / 10;
  return points.map((p) => `${round(p.x)},${round(p.y)}`).join(' ');
}

/** Horizontal bar from the zero line to the value, inside an area `width` wide. */
export function barSpan(value: number, axis: Axis, width: number): BarSpan {
  const scale = linearScale(axis.min, axis.max, 0, width);
  const zeroX = scale(0);
  const valueX = scale(value);
  const raw = Math.abs(valueX - zeroX);
  if (raw >= MIN_BAR_WIDTH) return { x: Math.min(zeroX, valueX), width: raw, zeroX };
  return { x: value < 0 ? zeroX - MIN_BAR_WIDTH : zeroX, width: MIN_BAR_WIDTH, zeroX };
}