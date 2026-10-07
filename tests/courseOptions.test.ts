import { describe, expect, it } from 'vitest';
import { listCourseOptions } from '../src/domain/stats';
import type { RoundStatus, RoundWithHoles } from '../src/domain/types';

interface Options {
  id: string;
  courseId?: string;
  courseName?: string;
  date?: string;
  createdAt?: string;
  status?: RoundStatus;
  numberOfHoles?: 9 | 18;
}

// Holes are irrelevant for course options, so rounds are built without them.
function make(o: Options): RoundWithHoles {
  const date = o.date ?? '2026-03-01';
  return {
    round: {
      id: o.id,
      courseId: o.courseId ?? 'c1',
      courseName: o.courseName ?? 'Course One',
      date,
      tee: 'Amarillas',
      numberOfHoles: o.numberOfHoles ?? 18,
      startHole: 1,
      status: o.status ?? 'finished',
      createdAt: o.createdAt ?? `${date}T08:00:00.000Z`,
      updatedAt: `${date}T12:00:00.000Z`,
    },
    holes: [],
  };
}

describe('listCourseOptions', () => {
  it('returns an empty list without rounds', () => {
    expect(listCourseOptions([])).toEqual([]);
  });

  it('ignores in-progress rounds, including courses that only have those', () => {
    const rounds = [
      make({ id: 'a', courseId: 'c1' }),
      make({ id: 'b', courseId: 'c1', status: 'in_progress' }),
      make({ id: 'c', courseId: 'c2', courseName: 'Only in progress', status: 'in_progress' }),
    ];
    expect(listCourseOptions(rounds)).toEqual([
      { courseId: 'c1', courseName: 'Course One', rounds: 1 },
    ]);
  });

  it('counts 9-hole and 18-hole rounds together', () => {
    const rounds = [
      make({ id: 'a', numberOfHoles: 18 }),
      make({ id: 'b', numberOfHoles: 9 }),
      make({ id: 'c', numberOfHoles: 9 }),
    ];
    expect(listCourseOptions(rounds).map((c) => c.rounds)).toEqual([3]);
  });

  it('takes the name from the latest round', () => {
    const rounds = [
      make({ id: 'new', courseName: 'New name', date: '2026-03-10' }),
      make({ id: 'old', courseName: 'Old name', date: '2026-03-01' }),
    ];
    expect(listCourseOptions(rounds)[0]?.courseName).toBe('New name');
  });

  it('breaks date ties with createdAt', () => {
    const rounds = [
      make({ id: 'late', courseName: 'Late', createdAt: '2026-03-01T18:00:00.000Z' }),
      make({ id: 'early', courseName: 'Early', createdAt: '2026-03-01T07:00:00.000Z' }),
    ];
    expect(listCourseOptions(rounds)[0]?.courseName).toBe('Late');
  });

  it('sorts by name, then id, whatever the input order', () => {
    const rounds = [
      make({ id: 'a', courseId: 'z', courseName: 'Same' }),
      make({ id: 'b', courseId: 'y', courseName: 'Same' }),
      make({ id: 'c', courseId: 'x', courseName: 'Alpha' }),
    ];
    expect(listCourseOptions(rounds).map((c) => c.courseId)).toEqual(['x', 'y', 'z']);
  });

  it('does not mutate its input', () => {
    const rounds = [make({ id: 'a' }), make({ id: 'b', courseId: 'c2', courseName: 'Alpha' })];
    const before = JSON.stringify(rounds);
    listCourseOptions(rounds);
    expect(JSON.stringify(rounds)).toBe(before);
  });
});