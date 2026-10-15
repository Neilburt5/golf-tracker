import { CLUB_CATALOG, isPutter, type ClubCode } from '../domain/clubs';

interface ClubGridProps {
  bag: readonly ClubCode[];
  onSelect: (club: ClubCode) => void;
  disabled?: boolean;
}

/** Club buttons in catalog order; the putter is a full-width button at the bottom. */
export function ClubGrid({ bag, onSelect, disabled = false }: ClubGridProps) {
  const clubs = CLUB_CATALOG.filter((club) => bag.includes(club.code));
  const regular = clubs.filter((club) => !isPutter(club.code));
  const putter = clubs.find((club) => isPutter(club.code));

  return (
    <div className="club-grid-wrap" role="group" aria-label="Palos">
      <div className="club-grid">
        {regular.map((club) => (
          <button
            key={club.code}
            type="button"
            className="club-btn"
            disabled={disabled}
            onClick={() => onSelect(club.code)}
          >
            {club.label}
          </button>
        ))}
      </div>
      {putter && (
        <button
          type="button"
          className="club-btn club-putter"
          disabled={disabled}
          onClick={() => onSelect(putter.code)}
        >
          {putter.label}
        </button>
      )}
    </div>
  );
}