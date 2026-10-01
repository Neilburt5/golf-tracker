import { describe, expect, it } from 'vitest';
import rawCourses from '../src/data/courses.json';
import { getCourseById, getCourses, validateCourses } from '../src/data/courseRepository';

function validCourse() {
  return {
    id: 'c1',
    name: 'Nine',
    location: 'X',
    numberOfHoles: 9,
    tees: ['White'],
    holes: Array.from({ length: 9 }, (_, i) => ({ number: i + 1, par: 4 })),
  };
}

describe('courses.json', () => {
  it('the bundled file is valid', () => {
    expect(() => validateCourses(rawCourses)).not.toThrow();
    expect(getCourses().length).toBeGreaterThan(0);
  });

  it('finds a course by id', () => {
    const first = getCourses()[0];
    expect(getCourseById(first.id)).toBe(first);
    expect(getCourseById('missing')).toBeUndefined();
  });
});

describe('validateCourses', () => {
  it('accepts a valid course', () => {
    expect(validateCourses([validCourse()])).toHaveLength(1);
  });

  it('rejects non-arrays', () => {
    expect(() => validateCourses({})).toThrow(/array/);
  });

  it('rejects duplicate ids', () => {
    expect(() => validateCourses([validCourse(), validCourse()])).toThrow(/duplicate/);
  });

  it('rejects wrong hole count', () => {
    const c = validCourse();
    c.holes.pop();
    expect(() => validateCourses([c])).toThrow(/exactly 9/);
  });

  it('rejects out-of-order hole numbers', () => {
    const c = validCourse();
    c.holes[3].number = 7;
    expect(() => validateCourses([c])).toThrow(/position 4/);
  });

  it('rejects invalid par', () => {
    const c = validCourse();
    c.holes[0].par = 2;
    expect(() => validateCourses([c])).toThrow(/invalid par/);
  });

  it('rejects missing tees', () => {
    const c = validCourse();
    c.tees = [];
    expect(() => validateCourses([c])).toThrow(/tee/);
  });
});