import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCourseById, getCourses } from '../data/courseRepository';
import { roundRepository } from '../data/roundRepository';
import type { Course, NumberOfHoles, StartHole } from '../domain/types';

/** full = the whole course, front = holes 1-9, back = holes 10-18. */
export type HoleRange = 'full' | 'front' | 'back';

/** An 18-hole course can be played in full or as either nine; a 9-hole course only in full. */
export function getRangeOptions(course: Course): HoleRange[] {
  return course.numberOfHoles === 18 ? ['full', 'front', 'back'] : ['full'];
}

export function resolveRange(
  course: Course,
  range: HoleRange,
): { numberOfHoles: NumberOfHoles; startHole: StartHole } {
  if (range === 'front') return { numberOfHoles: 9, startHole: 1 };
  if (range === 'back') return { numberOfHoles: 9, startHole: 10 };
  return { numberOfHoles: course.numberOfHoles, startHole: 1 };
}

export function useNewRoundForm() {
  const courses = getCourses();
  const navigate = useNavigate();

  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [tee, setTee] = useState(courses[0]?.tees[0] ?? '');
  const [range, setRange] = useState<HoleRange>('full');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const course = getCourseById(courseId);
  const canSubmit = course !== undefined && tee !== '' && !submitting;

  function selectCourse(id: string) {
    const next = getCourseById(id);
    if (!next) return;
    setCourseId(id);
    setTee(next.tees[0]);
    setRange('full');
  }

  async function submit() {
    if (!course || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { numberOfHoles, startHole } = resolveRange(course, range);
      const round = await roundRepository.createRound({ course, tee, numberOfHoles, startHole });
      navigate(`/round/${round.id}/hole/${startHole}`, { replace: true });
    } catch {
      setError('No se pudo crear la ronda. Inténtalo de nuevo.');
      setSubmitting(false);
    }
  }

  return {
    courses,
    course,
    tee,
    range,
    rangeOptions: course ? getRangeOptions(course) : [],
    canSubmit,
    submitting,
    error,
    selectCourse,
    setTee,
    setRange,
    submit,
  };
}