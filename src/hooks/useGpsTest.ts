import { useCallback, useEffect, useRef, useState } from 'react'
import { formatCaptureUpdate } from '../domain/gpsCapture'
import { formatLog, type GpsLogEntry } from '../domain/gpsLog'
import {
  CANCELLED_CODE,
  getSingleFix,
  queryGeolocationPermission,
  startShortCapture,
  type FixOptions,
  type GeoPermissionState,
  type ShortCaptureOptions,
} from '../services/geolocation'
import { loadStoredLog, saveStoredLog } from '../services/gpsTestStorage'

const MAX_ENTRIES = 300
const FIX_TIMEOUT_MS = 30_000

export const HIGH_ACCURACY_OPTIONS: FixOptions = {
  highAccuracy: true,
  timeoutMs: FIX_TIMEOUT_MS,
  maximumAgeMs: 0,
}

export const NORMAL_ACCURACY_OPTIONS: FixOptions = {
  highAccuracy: false,
  timeoutMs: FIX_TIMEOUT_MS,
  maximumAgeMs: 0,
}

/** Provisional values from D39/D40; phase 13b is meant to confirm or change them. */
export const SHORT_CAPTURE_OPTIONS: ShortCaptureOptions = {
  timeoutMs: 15_000,
  maxAgeMs: 3_000,
  maxAccuracyM: 20,
}

let entryCounter = 0

/** `crypto.randomUUID()` needs a secure context; a counter is enough for a log. */
function nextId(): string {
  entryCounter += 1
  return `${Date.now()}-${entryCounter}`
}

function detectStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

/** First line of every visit. In the log it shows whether iOS reloaded the page. */
function createOpenedEvent(): GpsLogEntry {
  return {
    kind: 'event',
    id: nextId(),
    at: Date.now(),
    text:
      `page opened | standalone=${detectStandalone() ? 'yes' : 'no'} | ` +
      `online=${navigator.onLine ? 'yes' : 'no'} | ua=${navigator.userAgent}`,
  }
}

function loadInitialEntries(): GpsLogEntry[] {
  return [...loadStoredLog(), createOpenedEvent()].slice(-MAX_ENTRIES)
}

/**
 * View-model of the GPS field test page. `requestFix` takes one position per
 * call; `requestShortCapture` listens for a few seconds after a tap and stops
 * by itself (D32 amendment, phase 13b). There is no continuous tracking. Also
 * logs page lifecycle events so that lock and background behaviour can be read
 * from the log afterwards.
 */
export function useGpsTest() {
  const [entries, setEntries] = useState<GpsLogEntry[]>(loadInitialEntries)
  const [pendingSince, setPendingSince] = useState<number | null>(null)
  const [permission, setPermission] = useState<GeoPermissionState | null>(null)
  const [visibility, setVisibility] = useState<DocumentVisibilityState>(document.visibilityState)
  const [standalone] = useState(detectStandalone)

  const requestIdRef = useRef(0)
  const pendingRef = useRef(false)
  const lastPermissionRef = useRef<GeoPermissionState | null>(null)
  const cancelCaptureRef = useRef<(() => void) | null>(null)

  const addEntry = useCallback((entry: GpsLogEntry) => {
    setEntries((previous) => [...previous, entry].slice(-MAX_ENTRIES))
  }, [])

  const addEvent = useCallback(
    (text: string) => addEntry({ kind: 'event', id: nextId(), at: Date.now(), text }),
    [addEntry],
  )

  /** Shows the permission state and logs it only when it changes. */
  const applyPermission = useCallback(
    (state: GeoPermissionState) => {
      setPermission(state)
      if (state !== lastPermissionRef.current) {
        lastPermissionRef.current = state
        addEvent(`permission state: ${state}`)
      }
    },
    [addEvent],
  )

  const refreshPermission = useCallback(async () => {
    applyPermission(await queryGeolocationPermission())
  }, [applyPermission])

  useEffect(() => {
    saveStoredLog(entries)
  }, [entries])

  useEffect(() => {
    let active = true
    // The state is set from the answer's callback, not synchronously in the effect.
    void queryGeolocationPermission().then((state) => {
      if (active) applyPermission(state)
    })

    const onVisibility = () => {
      setVisibility(document.visibilityState)
      addEvent(`visibility: ${document.visibilityState}`)
      if (document.visibilityState === 'visible') void refreshPermission()
    }
    const onPageHide = (event: PageTransitionEvent) =>
      addEvent(`pagehide persisted=${event.persisted ? 'yes' : 'no'}`)
    const onPageShow = (event: PageTransitionEvent) =>
      addEvent(`pageshow persisted=${event.persisted ? 'yes' : 'no'}`)
    const onOnline = () => addEvent('network: online')
    const onOffline = () => addEvent('network: offline')
    // Page Lifecycle events: Safari may never fire them, which is a finding too.
    const onFreeze = () => addEvent('lifecycle: freeze')
    const onResume = () => addEvent('lifecycle: resume')

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('freeze', onFreeze)
    document.addEventListener('resume', onResume)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('freeze', onFreeze)
      document.removeEventListener('resume', onResume)
    }
  }, [addEvent, applyPermission, refreshPermission])

  // Leaving the page must never leave a watch running.
  useEffect(() => {
    return () => {
      cancelCaptureRef.current?.()
    }
  }, [])

  /** Must be called straight from a tap handler (keeps the user gesture for iOS). */
  const requestFix = useCallback(
    (label: string, options: FixOptions) => {
      if (pendingRef.current) return
      pendingRef.current = true
      requestIdRef.current += 1
      const requestId = requestIdRef.current
      const requestedAt = Date.now()
      setPendingSince(requestedAt)

      void getSingleFix(options).then((result) => {
        const elapsedMs = Date.now() - requestedAt
        if (result.ok) {
          addEntry({
            kind: 'fix',
            id: nextId(),
            label,
            requestedAt,
            elapsedMs,
            fixTimestamp: result.timestamp,
            latitude: result.latitude,
            longitude: result.longitude,
            accuracy: result.accuracy,
            highAccuracy: options.highAccuracy,
          })
        } else {
          addEntry({
            kind: 'error',
            id: nextId(),
            label,
            requestedAt,
            elapsedMs,
            code: result.code,
            message: result.message,
            highAccuracy: options.highAccuracy,
          })
        }
        // A late answer to a request the user stopped waiting for is still logged,
        // but must not release a newer request.
        if (requestIdRef.current === requestId) {
          pendingRef.current = false
          setPendingSince(null)
        }
        void refreshPermission()
      })
    },
    [addEntry, refreshPermission],
  )

  /**
   * Short capture window (phase 13b): listens for a few seconds and stops by
   * itself at the first fresh, precise position. Every position received is
   * logged as an event; the result is logged as a FIX or an ERROR.
   * Must be called straight from a tap handler.
   */
  const requestShortCapture = useCallback(
    (label: string, options: ShortCaptureOptions) => {
      if (pendingRef.current) return
      pendingRef.current = true
      requestIdRef.current += 1
      const requestId = requestIdRef.current
      const requestedAt = Date.now()
      setPendingSince(requestedAt)

      const capture = startShortCapture(options, (update) =>
        addEvent(formatCaptureUpdate(update)),
      )
      cancelCaptureRef.current = capture.cancel

      void capture.result.then((result) => {
        // The user stopped waiting; cancelWait already released the page and logged it.
        if (!result.ok && result.code === CANCELLED_CODE) return

        const elapsedMs = Date.now() - requestedAt
        if (result.ok) {
          addEntry({
            kind: 'fix',
            id: nextId(),
            label: `${label} (captura corta${result.fresh ? '' : ', sin posición fresca'})`,
            requestedAt,
            elapsedMs,
            fixTimestamp: result.timestamp,
            latitude: result.latitude,
            longitude: result.longitude,
            accuracy: result.accuracy,
            highAccuracy: true,
          })
        } else {
          addEntry({
            kind: 'error',
            id: nextId(),
            label: `${label} (captura corta)`,
            requestedAt,
            elapsedMs,
            code: result.code,
            message: `${result.message} | updates=${result.updates}`,
            highAccuracy: true,
          })
        }
        if (requestIdRef.current === requestId) {
          pendingRef.current = false
          setPendingSince(null)
          cancelCaptureRef.current = null
        }
        void refreshPermission()
      })
    },
    [addEntry, addEvent, refreshPermission],
  )

  /** Stops waiting for a request that never answers; a late answer is still logged. */
  const cancelWait = useCallback(() => {
    cancelCaptureRef.current?.()
    cancelCaptureRef.current = null
    requestIdRef.current += 1
    pendingRef.current = false
    setPendingSince(null)
    addEvent('wait cancelled by user')
  }, [addEvent])

  const clearLog = useCallback(() => setEntries([]), [])

  const copyLog = useCallback(async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(formatLog(entries))
      return true
    } catch {
      return false
    }
  }, [entries])

  return {
    entries,
    pendingSince,
    permission,
    visibility,
    standalone,
    requestFix,
    requestShortCapture,
    cancelWait,
    clearLog,
    copyLog,
  }
}