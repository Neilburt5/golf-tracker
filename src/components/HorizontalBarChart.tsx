import { barSpan, niceAxis } from '../domain/chartScale';

export interface BarDatum {
  key: string;
  label: string;
  /** null = nothing to show (no bar, printed as a dash). */
  value: number | null;
  /** Sample size text under the bar, e.g. "6 hoyos · pocos hoyos". */
  sample: string;
  /** Small samples are drawn with a dashed outline instead of a solid bar. */
  lowSample: boolean;
}

interface HorizontalBarChartProps {
  data: readonly BarDatum[];
  ariaLabel: string;
  formatValue: (value: number | null) => string;
  caption?: string;
}

const WIDTH = 320;
const PAD = 6;
const ROW_HEIGHT = 62;
const BAR_TOP = 24;
const BAR_HEIGHT = 18;
const MAX_LABEL_CHARS = 20;

function truncate(label: string): string {
  return label.length > MAX_LABEL_CHARS ? `${label.slice(0, MAX_LABEL_CHARS - 1)}…` : label;
}

/**
 * One row per group: label and value on top, a bar from the zero line, the sample size below.
 * Meaning never relies on colour: direction from the zero line, printed value, dashed outline
 * and the words "pocos hoyos" for small samples.
 */
export function HorizontalBarChart({
  data,
  ariaLabel,
  formatValue,
  caption,
}: HorizontalBarChartProps) {
  if (data.length === 0) return <p className="muted">Sin datos.</p>;

  const values = data.flatMap((datum) => (datum.value === null ? [] : [datum.value]));
  const axis = niceAxis(values);
  const barArea = WIDTH - PAD * 2;
  const height = data.length * ROW_HEIGHT + 8;

  return (
    <figure className="chart">
      <svg
        className="chart-svg"
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={ariaLabel}
      >
        {data.map((datum, index) => {
          const top = index * ROW_HEIGHT + 4;
          const span = datum.value === null ? null : barSpan(datum.value, axis, barArea);
          return (
            <g key={datum.key}>
              <text className="chart-label" x={PAD} y={top + 16}>
                {truncate(datum.label)}
                <title>{datum.label}</title>
              </text>
              <text className="chart-value" x={WIDTH - PAD} y={top + 16} textAnchor="end">
                {formatValue(datum.value)}
              </text>
              <rect
                className="chart-track"
                x={PAD}
                y={top + BAR_TOP}
                width={barArea}
                height={BAR_HEIGHT}
              />
              {span && (
                <rect
                  className={datum.lowSample ? 'chart-bar-low' : 'chart-bar'}
                  x={PAD + span.x}
                  y={top + BAR_TOP}
                  width={span.width}
                  height={BAR_HEIGHT}
                />
              )}
              <text className="chart-sample" x={PAD} y={top + 56}>
                {datum.sample}
              </text>
            </g>
          );
        })}
        <line
          className="chart-zero"
          x1={PAD + barSpan(0, axis, barArea).zeroX}
          x2={PAD + barSpan(0, axis, barArea).zeroX}
          y1={4}
          y2={height - 4}
        />
      </svg>
      {caption && <figcaption className="muted">{caption}</figcaption>}
    </figure>
  );
}