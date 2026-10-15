/** Hash-route paths of the round screens (phase 17). Pure. */

export function roundHolePath(roundId: string, holeNumber: number): string {
  return `/round/${roundId}/hole/${holeNumber}`;
}

export function roundShotsPath(roundId: string, holeNumber: number): string {
  return `/round/${roundId}/hole/${holeNumber}/shots`;
}

export function roundSummaryPath(roundId: string): string {
  return `/round/${roundId}/summary`;
}