import { describe, expect, it } from 'vitest';
import { MAX_DISTANCE_FROM_COURSE_M, validateCourses } from '../src/data/courseRepository';
import type { Course, CourseHole } from '../src/domain/types';

const RETAMARES = { latitude: 40.60997228135536, longitude: -3.4685218323625966 };

function makeCourse(
  overrides: Partial<Course> = {},
  firstHole: Partial<CourseHole> = {},
): Course {
  return {
    id: 'test-9',
    name: 'Test',
    location: 'Somewhere',
    numberOfHoles: 9,
    tees: ['Blancas'],
    coordinates: RETAMARES,
    holes: Array.from({ length: 9 }, (_, i) => ({
      number: i + 1,
      par: 4,
      ...(i === 0 ? firstHole : {}),
    })),
    ...overrides,
  };
}

function validate(course: Course) {
  return () => validateCourses([course]);
}

describe('course geometry validation', () => {
  it('accepts courses and holes without geometry', () => {
    expect(validate(makeCourse())).not.toThrow();
    expect(validate(makeCourse({ coordinates: undefined }))).not.toThrow();
  });

  it('accepts a green and landmarks', () => {
    const course = makeCourse(
      {},
      {
        green: { latitude: 40.6102, longitude: -3.4650 },
        landmarks: [
          { kind: 'dogleg', latitude: 40.610954, longitude: -3.465485 },
          { kind: 'water', latitude: 40.6105, longitude: -3.4655, label: 'lago' },
          { kind: 'bunker', latitude: 40.6103, longitude: -3.4651 },
        ],
      },
    );
    expect(validate(course)).not.toThrow();
  });

  it('accepts the hole 1 dogleg measured on Google Maps', () => {
    const course = makeCourse(
      {},
      { landmarks: [{ kind: 'dogleg', latitude: 40.610954, longitude: -3.465485 }] },
    );
    expect(validate(course)).not.toThrow();
  });

  it('rejects a green with latitude out of range', () => {
    const course = makeCourse({ coordinates: undefined }, { green: { latitude: 91, longitude: 0 } });
    expect(validate(course)).toThrow(/hole 1: green\.latitude/);
  });

  it('rejects a green with a non-numeric longitude', () => {
    const course = makeCourse(
      { coordinates: undefined },
      { green: { latitude: 40.6, longitude: '-3.4' as unknown as number } },
    );
    expect(validate(course)).toThrow(/hole 1: green\.longitude/);
  });

  it('rejects an unknown landmark kind', () => {
    const course = makeCourse(
      {},
      {
        landmarks: [
          { kind: 'tree' as unknown as 'water', latitude: 40.61, longitude: -3.466 },
        ],
      },
    );
    expect(validate(course)).toThrow(/landmarks\[0\]\.kind/);
  });

  it('rejects landmarks that is not an array', () => {
    const course = makeCourse({}, { landmarks: {} as unknown as [] });
    expect(validate(course)).toThrow(/landmarks must be an array/);
  });

  it('rejects an empty landmark label', () => {
    const course = makeCourse(
      {},
      { landmarks: [{ kind: 'water', latitude: 40.61, longitude: -3.466, label: '  ' }] },
    );
    expect(validate(course)).toThrow(/label/);
  });

  it('rejects a landmark with invalid coordinates', () => {
    const course = makeCourse(
      { coordinates: undefined },
      { landmarks: [{ kind: 'water', latitude: 40.61, longitude: 200 }] },
    );
    expect(validate(course)).toThrow(/landmarks\[0\]\.longitude/);
  });

  it('rejects a point far from the course (sign typo)', () => {
    const course = makeCourse({}, { green: { latitude: 40.6102, longitude: 3.4650 } });
    expect(validate(course)).toThrow(/hole 1: green is \d+ m from the course coordinates/);
  });

  it('rejects a landmark far from the course', () => {
    const course = makeCourse(
      {},
      { landmarks: [{ kind: 'bunker', latitude: 41.2, longitude: -3.4685 }] },
    );
    expect(validate(course)).toThrow(/landmarks\[0\] is \d+ m from the course/);
  });

  it('skips the distance check when the course has no coordinates', () => {
    const course = makeCourse(
      { coordinates: undefined },
      { green: { latitude: 41.5, longitude: -3.4 } },
    );
    expect(validate(course)).not.toThrow();
  });

  it('keeps the limit at 3 km', () => {
    expect(MAX_DISTANCE_FROM_COURSE_M).toBe(3000);
  });

    it('accepts a testero landmark', () => {
    const course = makeCourse(
      {},
      { landmarks: [{ kind: 'testero', latitude: 40.607259, longitude: -3.461289 }] },
    );
    expect(validate(course)).not.toThrow();
  });
});