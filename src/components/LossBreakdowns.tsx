import { formatDecimal, formatSignedDecimal, plural } from '../domain/format';
import { highestAverageToPar, isLowSample } from '../domain/lossRanking';
import type { Stats } from '../domain/stats';
import { CollapsibleSection } from './CollapsibleSection';
import { HorizontalBarChart, type BarDatum } from './HorizontalBarChart';

interface LossBreakdownsProps {
  stats: Pick<Stats, 'byPar' | 'byHoleNumber' | 'byCourse' | 'puttsByGir'>;
}

function holesText(holes: number): string {
  const base = plural(holes, 'hoyo', 'hoyos');
  return isLowSample(holes) ? `${base} · pocos hoyos` : base;
}

const formatToParValue = (value: number | null) => formatSignedDecimal(value);
const formatPuttsValue = (value: number | null) => formatDecimal(value, 2);

/**
 * "Where do I lose strokes": descriptive breakdowns of the average score to par per hole.
 * Every row shows its sample size. Nothing here explains causes.
 */
export function LossBreakdowns({ stats }: LossBreakdownsProps) {
  const { byPar, byHoleNumber, byCourse, puttsByGir } = stats;
  const showCourses = byCourse.length > 1;

  const parData: BarDatum[] = byPar.map((group) => ({
    key: `par-${group.par}`,
    label: `Par ${group.par}`,
    value: group.stats.averageScoreToPar,
    sample: holesText(group.stats.holes),
    lowSample: isLowSample(group.stats.holes),
  }));

  const holeData: BarDatum[] = byHoleNumber.map((group) => ({
    key: `hole-${group.holeNumber}`,
    label: `Hoyo ${group.holeNumber}`,
    value: group.stats.averageScoreToPar,
    sample: holesText(group.stats.holes),
    lowSample: isLowSample(group.stats.holes),
  }));

  const courseData: BarDatum[] = byCourse.map((group) => ({
    key: `course-${group.courseId}`,
    label: group.courseName,
    value: group.stats.averageScoreToPar,
    sample: `${plural(group.rounds, 'ronda', 'rondas')} · ${holesText(group.stats.holes)}`,
    lowSample: isLowSample(group.stats.holes),
  }));

  const puttsData: BarDatum[] = [
    { key: 'gir', label: 'Con GIR', group: puttsByGir.withGir },
    { key: 'no-gir', label: 'Sin GIR', group: puttsByGir.withoutGir },
  ].map(({ key, label, group }) => ({
    key,
    label,
    value: group.averagePutts,
    sample: holesText(group.holes),
    lowSample: isLowSample(group.holes),
  }));

  const worstPar = highestAverageToPar(byPar);
  const worstHole = highestAverageToPar(byHoleNumber);
  const worstCourse = showCourses ? highestAverageToPar(byCourse) : null;
  const hasHighlights = worstPar !== null || worstHole !== null || worstCourse !== null;

  return (
    <div className="stack">
      <p className="muted">
        Media de golpes sobre par por hoyo, con el filtro actual. Los grupos con menos de 5 hoyos se
        dibujan con borde discontinuo y no entran en los destacados.
      </p>

      {hasHighlights ? (
        <ul className="highlights" aria-label="Medias más altas">
          {worstPar && (
            <li>
              Tipo de par con la media más alta: <strong>Par {worstPar.par}</strong> (
              {formatSignedDecimal(worstPar.stats.averageScoreToPar)} ·{' '}
              {plural(worstPar.stats.holes, 'hoyo', 'hoyos')})
            </li>
          )}
          {worstHole && (
            <li>
              Hoyo con la media más alta: <strong>Hoyo {worstHole.holeNumber}</strong> (
              {formatSignedDecimal(worstHole.stats.averageScoreToPar)} ·{' '}
              {plural(worstHole.stats.holes, 'hoyo', 'hoyos')})
            </li>
          )}
          {worstCourse && (
            <li>
              Campo con la media más alta: <strong>{worstCourse.courseName}</strong> (
              {formatSignedDecimal(worstCourse.stats.averageScoreToPar)} ·{' '}
              {plural(worstCourse.stats.holes, 'hoyo', 'hoyos')})
            </li>
          )}
        </ul>
      ) : (
        <p className="muted">Todavía no hay grupos con al menos 5 hoyos para compararlos.</p>
      )}

      <CollapsibleSection title="Por tipo de par" level="sub" defaultOpen>
        <HorizontalBarChart
          data={parData}
          ariaLabel="Media de golpes sobre par por hoyo, por tipo de par"
          formatValue={formatToParValue}
          caption="La línea vertical marca el par. A su derecha, por encima del par."
        />
      </CollapsibleSection>

      <CollapsibleSection title="Por número de hoyo" level="sub">
        <HorizontalBarChart
          data={holeData}
          ariaLabel="Media de golpes sobre par por número de hoyo"
          formatValue={formatToParValue}
          caption="Número real del hoyo en el campo (1-18). La línea vertical marca el par."
        />
      </CollapsibleSection>

      <CollapsibleSection title="Putts con y sin GIR" level="sub">
        <HorizontalBarChart
          data={puttsData}
          ariaLabel="Media de putts por hoyo, con y sin green en regulación"
          formatValue={formatPuttsValue}
          caption="Media de putts por hoyo."
        />
      </CollapsibleSection>

      {showCourses && (
        <CollapsibleSection title="Por campo" level="sub">
          <HorizontalBarChart
            data={courseData}
            ariaLabel="Media de golpes sobre par por hoyo, por campo"
            formatValue={formatToParValue}
            caption="La línea vertical marca el par."
          />
        </CollapsibleSection>
      )}
    </div>
  );
}