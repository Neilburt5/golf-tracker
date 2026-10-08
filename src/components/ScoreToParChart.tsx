import { linePoints, linearScale, niceAxis, pointsAttribute } from '../domain/chartScale';
import { formatDayMonth, formatToPar } from '../domain/format';
import type { RoundResult } from '../domain/stats';

/** Only the most recent rounds are drawn; older ones would make the line unreadable. */
export const MAX_CHART_ROUNDS = 30;

const WIDTH = 320;
const HEIGHT = 230;
const MARGIN = { top: 22, right: 14, bottom: 40, left: 42 };

interface ScoreToParChartProps {
  /** Complete rounds of one length, oldest first (`roundLevel.results`). */
  results: readonly RoundResult[];
}

function tickLabel(tick: number): string {
  if (tick === 0) return 'Par';
  return tick > 0 ? `+${tick}` : `${tick}`;
}

export function ScoreToParChart({ results }: ScoreToParChartProps) {
  if (results.length < 2) {
    return (
      <p className="muted">Hacen falta al menos 2 rondas completas para ver la evolución.</p>
    );
  }

  const shown = results.slice(-MAX_CHART_ROUNDS);
  const first = shown[0];
  const last = shown[shown.length - 1];
  if (!first || !last) return null;

  const values = shown.map((result) => result.scoreToPar);
  const axis = niceAxis(values, 5, 1); // whole-number ticks
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const points = linePoints(values, axis, plotWidth, plotHeight);
  const yOf = linearScale(axis.min, axis.max, plotHeight, 0);
  const lastPoint = points[points.length - 1];
  if (!lastPoint) return null;

  const description =
    `Evolución del resultado sobre par en ${shown.length} rondas, ` +
    `de ${formatToPar(first.scoreToPar) ?? ''} a ${formatToPar(last.scoreToPar) ?? ''}.`;

  return (
    <figure className="chart">
      <svg
        className="chart-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={description}
      >
        <g transform={`translate(${MARGIN.left} ${MARGIN.top})`}>
          {axis.ticks.map((tick) => (
            <g key={tick}>
              <line
                className={tick === 0 ? 'chart-zero' : 'chart-grid'}
                x1={0}
                x2={plotWidth}
                y1={yOf(tick)}
                y2={yOf(tick)}
              />
              <text className="chart-tick" x={-8} y={yOf(tick)} dy="0.35em" textAnchor="end">
                {tickLabel(tick)}
              </text>
            </g>
          ))}

          <polyline className="chart-line" points={pointsAttribute(points)} />

          {shown.map((result, index) => {
            const point = points[index];
            if (!point) return null;
            return (
              <circle key={result.roundId} className="chart-dot" cx={point.x} cy={point.y} r={6}>
                <title>
                  {`${formatDayMonth(result.date)} · ${result.courseName} · ${result.totalScore} (${formatToPar(result.scoreToPar) ?? ''})`}
                </title>
              </circle>
            );
          })}

          <text
            className="chart-value"
            x={lastPoint.x}
            y={lastPoint.y - 12}
            textAnchor="end"
          >
            {formatToPar(last.scoreToPar)}
          </text>

          <text className="chart-tick" x={0} y={plotHeight + 26} textAnchor="start">
            {formatDayMonth(first.date)}
          </text>
          <text className="chart-tick" x={plotWidth} y={plotHeight + 26} textAnchor="end">
            {formatDayMonth(last.date)}
          </text>
        </g>
      </svg>
      <figcaption className="muted">
        Cada punto es una ronda completa, de la más antigua a la más reciente.
        {results.length > MAX_CHART_ROUNDS &&
          ` Se muestran las últimas ${MAX_CHART_ROUNDS} de ${results.length}.`}
      </figcaption>
    </figure>
  );
}