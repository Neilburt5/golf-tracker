import { useSyncExternalStore } from 'react';

/**
 * A clock that ticks every few seconds (phase 18), used to age positions and wind on screen.
 * Built on useSyncExternalStore so no component calls Date.now() while rendering.
 * The value is quantized to 5 s: it only changes when the screen needs to redraw.
 */

const QUANTUM_MS = 5_000;
const POLL_MS = 2_500;

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, POLL_MS);
  return () => clearInterval(id);
}

function getSnapshot(): number {
  return Math.floor(Date.now() / QUANTUM_MS) * QUANTUM_MS;
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}