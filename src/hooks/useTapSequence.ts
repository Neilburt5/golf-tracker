import { useCallback, useRef } from 'react'

/**
 * Returns a click handler that calls `onComplete` after `count` taps, each
 * within `windowMs` of the previous one. Used for the hidden entry to the GPS
 * test page, which an installed PWA cannot reach by typing a URL.
 */
export function useTapSequence(
  count: number,
  windowMs: number,
  onComplete: () => void,
): () => void {
  const taps = useRef(0)
  const lastTap = useRef(0)

  return useCallback(() => {
    const now = Date.now()
    taps.current = now - lastTap.current <= windowMs ? taps.current + 1 : 1
    lastTap.current = now
    if (taps.current >= count) {
      taps.current = 0
      onComplete()
    }
  }, [count, windowMs, onComplete])
}