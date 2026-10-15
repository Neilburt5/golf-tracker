import { useMemo, useState } from 'react';
import { bearingDegrees } from '../domain/geo';
import {
  buildHoleTargets,
  distanceToTarget,
  fixAgeMsAt,
  formatFixAge,
  formatTargetDistance,
  greenTarget,
  isLiveFixStale,
  resolveTarget,
} from '../domain/holeTargets';
import { formatWindLine, formatWindTime, windComponents } from '../domain/liveWind';
import { formatGpsState } from '../domain/shotFormat';
import type { CourseCoordinates, CourseHole, ShotFix } from '../domain/types';
import { useCurrentWind } from '../hooks/useCurrentWind';
import { useLivePosition } from '../hooks/useLivePosition';
import { useNow } from '../hooks/useNow';

interface LiveInfoPanelProps {
  courseId: string;
  hole: CourseHole | undefined;
  coordinates: CourseCoordinates | undefined;
  /** Newest position among the shots of this hole; also feeds the distances for free. */
  lastShotFix: ShotFix | null;
}

/**
 * Live information at the top of the shots screen (phase 18). Informational only: it never
 * blocks recording a club. Renders nothing when the hole has no geometry and no wind is known.
 */
export function LiveInfoPanel({ courseId, hole, coordinates, lastShotFix }: LiveInfoPanelProps) {
  const targets = useMemo(() => buildHoleTargets(hole), [hole]);
  const hasTargets = targets.length > 0;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const now = useNow();
  const position = useLivePosition(hasTargets, lastShotFix);
  const windState = useCurrentWind(courseId, coordinates, true, now);

  const wind = windState.wind;
  if (!hasTargets && !wind) return null;

  const target = resolveTarget(targets, selectedId);
  const fix = position.fix;
  const distance = fix && target ? distanceToTarget(fix, target.point) : null;
  const ageMs = fix ? fixAgeMsAt(fix, now) : null;
  const stale = ageMs !== null && isLiveFixStale(ageMs);

  let statusText: string;
  if (position.shotCapturing) {
    statusText = 'Tomando posición del golpe…';
  } else if (position.capturing) {
    statusText = 'Tomando posición…';
  } else if (!fix) {
    if (position.permission === 'denied') {
      statusText = 'Ubicación desactivada';
    } else if (position.status === 'failed') {
      statusText = formatGpsState({
        capturing: false,
        fix: null,
        failure: position.failure ?? undefined,
      });
    } else if (position.permission !== 'granted') {
      statusText = 'Toca para medir la distancia';
    } else {
      statusText = 'Sin posición';
    }
  } else {
    statusText = `Posición ${formatFixAge(ageMs ?? 0)}${stale ? ' · Actualiza' : ''}`;
  }

  const green = greenTarget(targets);
  const components =
    wind && fix && green && wind.directionDeg !== null
      ? windComponents(wind.speedKmh, wind.directionDeg, bearingDegrees(fix, green.point))
      : null;

  const showButton = hasTargets && position.permission !== 'denied';
  const buttonLabel =
    !fix && position.permission !== 'granted' ? 'Medir distancia' : 'Actualizar';

  const handleRefresh = () => {
    // Both start from the tap: the position keeps the user gesture (D43).
    position.refresh();
    windState.refresh();
  };

  const dim = stale || position.capturing || position.shotCapturing;

  return (
    <section className="live-panel" aria-label="Información en vivo">
      {hasTargets && target && (
        <>
          <div className={dim ? 'live-main live-dim' : 'live-main'}>
            <div className="live-distance-col">
              <span className="live-target">{target.label}</span>
              <strong className="live-distance">
                {distance ? formatTargetDistance(distance) : '—'}
              </strong>
            </div>
            <span className="muted live-status" role="status">
              {statusText}
            </span>
          </div>

          {targets.length > 1 && (
            <div className="live-chips" role="group" aria-label="Objetivo">
              {targets.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="live-chip"
                  aria-pressed={item.id === target.id}
                  onClick={() => setSelectedId(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {showButton && (
            <button
              type="button"
              className="live-refresh"
              disabled={!position.canRefresh}
              onClick={handleRefresh}
            >
              {buttonLabel}
            </button>
          )}
        </>
      )}

      {wind && (
        <div className="live-wind">
          <span>{formatWindLine(wind, components)}</span>
          <span className="muted">
            {formatWindTime(wind.observedAt)}
            {windState.failed ? ' · sin actualizar' : ''}
          </span>
          <span className="muted live-note">
            Valor de cuadrícula a 10 m, no el viento de tu posición. Datos meteorológicos:{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo.com
            </a>{' '}
            (CC BY 4.0)
          </span>
        </div>
      )}
    </section>
  );
}