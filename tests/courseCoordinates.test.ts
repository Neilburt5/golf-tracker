import { describe, expect, it } from 'vitest';
import { validateCourses } from '../src/data/courseRepository';

function rawCourse(extra: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    name: 'Campo',
    location: 'Madrid',
    numberOfHoles: 9,
    tees: ['Blancas'],
    holes: Array.from({ length: 9 }, (_, i) => ({ number: i + 1, par: 4 })),
    ...extra,
  };
}

describe('course coordinates', () => {
  it('are optional', () => {
    expect(() => validateCourses([rawCourse()])).not.toThrow();
  });

  it('accept valid coordinates', () => {
    expect(() =>
      validateCourses([rawCourse({ coordinates: { latitude: 40.5, longitude: -3.5 } })]),
    ).not.toThrow();
  });

  it('reject out-of-range or non-numeric values', () => {
    expect(() =>
      validateCourses([rawCourse({ coordinates: { latitude: 120, longitude: -3.5 } })]),
    ).toThrow();
    expect(() =>
      validateCourses([rawCourse({ coordinates: { latitude: 40.5, longitude: '3' } })]),
    ).toThrow();
    expect(() => validateCourses([rawCourse({ coordinates: {} })])).toThrow();
  });
});