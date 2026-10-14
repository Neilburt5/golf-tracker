import type { ClubCode } from './clubs';

export type NumberOfHoles = 9 | 18;
export type StartHole = 1 | 10;
export type RoundStatus = 'in_progress' | 'finished';

export interface CourseCoordinates {
  latitude: number;
  longitude: number;
}

/** A point on the map, in the same shape as the course coordinates. */
export type GeoPoint = CourseCoordinates;


export type LandmarkKind = 'dogleg' | 'water' | 'bunker' | 'testero';

export interface Landmark extends GeoPoint {
  kind: LandmarkKind;
  /** Only needed to tell apart two landmarks of the same kind on one hole. */
  label?: string;
}

export interface CourseHole {
  number: number;
  par: number;
  /** Center of the green, copied from a satellite map (D50, D51). Optional. */
  green?: GeoPoint;
  /** Dogleg corners, water, bunkers. Optional. */
  landmarks?: Landmark[];
}

export interface Course {
  id: string;
  name: string;
  location: string;
  numberOfHoles: NumberOfHoles;
  tees: string[];
  /** Course location, used only for the weather request (D34). Optional. */
  coordinates?: CourseCoordinates;
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

/**
 * A round together with all of its holes (and its weather and shots, if known).
 * Used by the rounds list and by backups.
 */
export interface RoundWithHoles {
  round: Round;
  holes: Hole[];
  weather?: RoundWeather;
  /** Present only when at least one shot was recorded. Ordered by hole number, then sequence. */
  shots?: Shot[];
}

/**
 * Weather snapshot of a round (D44): aggregate of the hourly values of the round window.
 * Wind is a 10 m grid value, not the wind at the ball.
 */
export interface RoundWeather {
  roundId: string;
  source: 'open-meteo';
  /** Course coordinates used for the request (never the user's position). */
  latitude: number;
  longitude: number;
  windowStart: string; // ISO UTC
  windowEnd: string; // ISO UTC
  /** Number of hourly slots averaged. */
  hours: number;
  fetchedAt: string; // ISO
  temperatureC: number;
  precipitationMm: number;
  /** Surface pressure (not sea level). */
  pressureHpa: number;
  windSpeedKmh: number;
  /** Direction the wind comes from, 0-359. Null when calm or cancelling out. */
  windDirectionDeg: number | null;
  windGustKmh: number | null;
}

/**
 * One GPS position taken when a club was selected (D32, D39).
 * `fresh` is true when it met the age <= 3 s and accuracy <= 20 m criteria; false means
 * the best position of the capture window (best effort).
 */
export interface ShotFix {
  latitude: number;
  longitude: number;
  /** Meters, as reported by the device. */
  accuracy: number;
  /** ISO of `position.timestamp`: when the device says the fix was taken. */
  fixedAt: string;
  fresh: boolean;
}

/**
 * One recorded club selection (V0.4, D37). Linked to its hole by `[roundId+holeNumber]`.
 * A shot with the putter is only a position marker: it ends the previous shot's distance
 * and is not counted as a stroke. Putts still come from `Hole.putts`.
 */
export interface Shot {
  id: string;
  roundId: string;
  holeNumber: number;
  /** 1-based order within the hole. Assigned by the repository from the array order. */
  sequence: number;
  club: ClubCode;
  /** null = no position (permission denied or capture failed); the club is still recorded. */
  fix: ShotFix | null;
  createdAt: string; // ISO of the tap
}

/** What a caller provides to save the shots of a hole; the repository adds the rest. */
export type ShotInput = Omit<Shot, 'roundId' | 'holeNumber' | 'sequence'>;

/** Row of the `settings` table holding the club bag. */
export interface ClubBagSetting {
  key: 'clubBag';
  value: ClubCode[];
}