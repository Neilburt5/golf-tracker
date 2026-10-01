import type { Round } from '../domain/types';

interface ActiveRoundCardProps {
  round: Round;
  holeNumber: number;
}

export function ActiveRoundCard({ round, holeNumber }: ActiveRoundCardProps) {
  const date = new Date(round.date).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="card">
      <strong>{round.courseName}</strong>
      <span>
        {date} · Tees {round.tee}
      </span>
      <span>Por el hoyo {holeNumber}</span>
    </div>
  );
}