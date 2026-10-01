export type NumberOfHoles = 9 | 18;
export type StartHole = 1 | 10;
export type RoundStatus = 'in_progress' | 'finished';

export interface CourseHole {
  number: number;
  par: number;
}

export interface Course {
  id: string;
  name: string;
  location: string;
  numberOfHoles: NumberOfHoles;
  tees: string[];
  holes: CourseHole[];
}

export interface Round {
  id: string;
  courseId: string;
  courseName: string; // snapshot
  date: string; // ISO
  tee: string;
  numberOfHoles: NumberOfHoles;
  startHole: StartHole;
  status: RoundStatus;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface Hole {
  id: string;
  roundId: string;
  holeNumber: number;
  par: number; // snapshot
  score: number | null; // null = not yet saved
  putts: number;
  fairway: boolean | null; // null = not applicable (par 3)
  gir: boolean;
  penaltyStrokes: number;
  bunker: boolean;
  upAndDown: boolean | null; // null = no opportunity
}

/**
 * Derived statistics. Never stored (see decisions D5).
 * Only holes with a saved score ("played" holes) are counted.
 * Percentages are 0-100 (unrounded), or null when there is nothing to divide by.
 */
export interface RoundStats {
  holesPlayed: number;
  totalScore: number;
  totalPar: number;
  scoreToPar: number;
  totalPutts: number;
  fairwaysHit: number;
  fairwayOpportunities: number;
  girCount: number;
  girPercentage: number | null;
  penaltyStrokes: number;
  bunkers: number;
  upAndDownAttempts: number;
  upAndDownMade: number;
  upAndDownPercentage: number | null;
  threePutts: number;
}