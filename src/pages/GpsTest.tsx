import { useEffect, useState } from 'react'
import { BigButton, BigLink } from '../components/BigButton'
import { formatLines, formatLog } from '../domain/gpsLog'
import {
  HIGH_ACCURACY_OPTIONS,
  NORMAL_ACCURACY_OPTIONS,
  SHORT_CAPTURE_OPTIONS,
  useGpsTest,
} from '../hooks/useGpsTest'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import type { GeoPermissionState } from '../services/geolocation'
import './gpsTest.css'

/** Situation tags written into each log line, so the log can be read later. */
const SITUATIONS = [
  'parado',
  'andando',
  'tras-bloqueo',
  'tras-segundo-plano',
  'modo-avion',
  'otro',
] as const

type CopyState = 'idle' | 'copied' | 'failed'

function permissionText(state: GeoPermissionState | null): string {
  switch (state) {
    case 'granted':
      return 'concedido'
    case 'denied':
      return 'denegado'
    case 'prompt':
      return 'sin preguntar todavía'
    case 'unsupported':
      return 'el navegador no lo informa'
    default:
      return '…'
  }
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [active])
  return now
}

/**
 * Hidden page (phase 13) to observe single GPS fixes on the real iPhone.
 * Not linked from the main flow; opened by tapping the build line on Home 5 times.
 */
export function GpsTest() {
  const online = useOnlineStatus()
  const gps = useGpsTest()
  const [label, setLabel] = useState<string>(SITUATIONS[0])
  const [confirmClear, setConfirmClear] = useState(false)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const now = useNow(gps.pendingSince !== null)

  const waitedSeconds =
    gps.pendingSince === null ? 0 : Math.max(0, Math.round((now - gps.pendingSince) / 1000))

  const lines = formatLines(gps.entries)
  const items = gps.entries
    .map((entry, index) => ({ id: entry.id, kind: entry.kind, text: lines[index] }))
    .reverse()

  async function handleCopy() {
    const ok = await gps.copyLog()
    setCopyState(ok ? 'copied' : 'failed')
  }

  return (
    <div className="screen gps-test">
      <h1 className="title">Prueba de GPS</h1>
      <p className="muted">
        Una posición por toque. No se guarda nada en la base de datos; el registro vive solo en
        este dispositivo.
      </p>

      <section className="card" aria-label="Estado">
        <span>
          App instalada: <strong>{gps.standalone ? 'sí' : 'no (abierta en Safari)'}</strong>
        </span>
        <span>
          Conexión: <strong>{online ? 'con conexión' : 'sin conexión'}</strong>
        </span>
        <span>
          Permiso de ubicación: <strong>{permissionText(gps.permission)}</strong>
        </span>
        <span>
          Pantalla: <strong>{gps.visibility === 'visible' ? 'visible' : 'oculta'}</strong>
        </span>
      </section>

      <fieldset className="field">
        <legend>Situación (se anota en el registro)</legend>
        <div className="options">
          {SITUATIONS.map((situation) => (
            <button
              key={situation}
              type="button"
              className="option"
              aria-pressed={label === situation}
              onClick={() => setLabel(situation)}
            >
              {situation}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="stack">
        <BigButton
          disabled={gps.pendingSince !== null}
          onClick={() => gps.requestFix(label, HIGH_ACCURACY_OPTIONS)}
        >
          Obtener posición (alta precisión)
        </BigButton>
        <BigButton
          variant="secondary"
          disabled={gps.pendingSince !== null}
          onClick={() => gps.requestFix(label, NORMAL_ACCURACY_OPTIONS)}
        >
                    Obtener posición (precisión normal)
        </BigButton>
        <BigButton
          disabled={gps.pendingSince !== null}
          onClick={() => gps.requestShortCapture(label, SHORT_CAPTURE_OPTIONS)}
        >
          Captura corta (máx. 15 s)
        </BigButton>
      </div>
      <p className="muted">
        La captura corta escucha unos segundos y se detiene sola en cuanto llega una posición de
        menos de 3 s de antigüedad y 20 m de precisión. Cada posición recibida queda en el
        registro.
      </p>

      {gps.pendingSince !== null && (
        <div className="warning" role="status">
          <strong>Esperando posición… {waitedSeconds} s</strong>
          <button type="button" className="link-btn" onClick={gps.cancelWait}>
            Dejar de esperar
          </button>
        </div>
      )}

      <h2 className="subtitle">Registro ({gps.entries.length})</h2>

      {confirmClear ? (
        <div className="warning" role="alert">
          <p className="gps-confirm-text">
            ¿Borrar todo el registro? No se puede deshacer. Cópialo antes si lo necesitas.
          </p>
          <div className="actions-row">
            <BigButton
              onClick={() => {
                gps.clearLog()
                setConfirmClear(false)
                setCopyState('idle')
              }}
            >
              Borrar
            </BigButton>
            <BigButton variant="secondary" onClick={() => setConfirmClear(false)}>
              Cancelar
            </BigButton>
          </div>
        </div>
      ) : (
        <div className="actions-row">
          <BigButton onClick={handleCopy} disabled={gps.entries.length === 0}>
            Copiar registro
          </BigButton>
          <BigButton
            variant="secondary"
            onClick={() => setConfirmClear(true)}
            disabled={gps.entries.length === 0}
          >
            Borrar registro
          </BigButton>
        </div>
      )}

      {copyState === 'copied' && <p className="status online">Registro copiado.</p>}
      {copyState === 'failed' && (
        <>
          <p role="alert" className="error">
            No se pudo copiar automáticamente. Selecciona el texto de abajo y cópialo a mano.
          </p>
          <textarea
            className="gps-log-text"
            readOnly
            rows={8}
            value={formatLog(gps.entries)}
            onFocus={(event) => event.currentTarget.select()}
          />
        </>
      )}

      {items.length === 0 ? (
        <p className="muted">Todavía no hay registro.</p>
      ) : (
        <ol className="gps-log" aria-label="Registro (el más reciente primero)">
          {items.map((item) => (
            <li key={item.id} className={`gps-log-item gps-log-${item.kind}`}>
              {item.text}
            </li>
          ))}
        </ol>
      )}

      <BigLink to="/" variant="secondary">
        Volver
      </BigLink>
    </div>
  )
}