import type { Hole } from '../domain/types';

interface HoleProgressProps {
  holes: readonly Hole[];
  currentHoleNumber: number;
  onSelect: (holeNumber: number) => void;
}

/** Grid of hole numbers: current is highlighted, played holes have a solid border. */
export function HoleProgress({ holes, currentHoleNumber, onSelect }: HoleProgressProps) {
  return (
    <nav className="progress" aria-label="Hoyos">
      {holes.map((hole) => {
        const classes = ['dot'];
        if (hole.score !== null) classes.push('dot-played');
        if (hole.holeNumber === currentHoleNumber) classes.push('dot-current');
        return (
          <button
            key={hole.id}
            type="button"
            className={classes.join(' ')}
            aria-current={hole.holeNumber === currentHoleNumber ? 'step' : undefined}
            aria-label={`Hoyo ${hole.holeNumber}${hole.score !== null ? ', guardado' : ''}`}
            onClick={() => onSelect(hole.holeNumber)}
          >
            {hole.holeNumber}
          </button>
        );
      })}
    </nav>
  );
}