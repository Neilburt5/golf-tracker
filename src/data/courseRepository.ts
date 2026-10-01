import rawCourses from './courses.json';
import type { Course } from '../domain/types';

/** Validates the hand-edited courses file. Throws a clear error on the first problem. */
export function validateCourses(raw: unknown): Course[] {
  if (!Array.isArray(raw)) {
    throw new Error('courses.json must contain an array of courses');
  }

  const seenIds = new Set<string>();

  for (const course of raw as Course[]) {
    const label = `Course "${course?.id ?? '?'}"`;

    if (typeof course.id !== 'string' || course.id.trim() === '') {
      throw new Error(`${label}: id is required`);
    }
    if (seenIds.has(course.id)) {
      throw new Error(`${label}: duplicate id`);
    }
    seenIds.add(course.id);

    if (typeof course.name !== 'string' || course.name.trim() === '') {
      throw new Error(`${label}: name is required`);
    }
    if (course.numberOfHoles !== 9 && course.numberOfHoles !== 18) {
      throw new Error(`${label}: numberOfHoles must be 9 or 18`);
    }
    if (!Array.isArray(course.tees) || course.tees.length === 0) {
      throw new Error(`${label}: at least one tee is required`);
    }
    if (!Array.isArray(course.holes) || course.holes.length !== course.numberOfHoles) {
      throw new Error(`${label}: holes must contain exactly ${course.numberOfHoles} entries`);
    }
    course.holes.forEach((hole, index) => {
      if (hole.number !== index + 1) {
        throw new Error(`${label}: hole at position ${index + 1} has number ${hole.number}`);
      }
      if (!Number.isInteger(hole.par) || hole.par < 3 || hole.par > 6) {
        throw new Error(`${label}: hole ${hole.number} has invalid par ${hole.par}`);
      }
    });
  }

  return raw as Course[];
}

const courses: Course[] = validateCourses(rawCourses);

export function getCourses(): Course[] {
  return courses;
}

export function getCourseById(id: string): Course | undefined {
  return courses.find((course) => course.id === id);
}