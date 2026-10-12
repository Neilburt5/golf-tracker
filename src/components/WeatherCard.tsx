import { formatWeatherLine } from '../domain/weather';
import type { RoundWeather } from '../domain/types';
import type { RoundWeatherOutcome } from '../hooks/useWeather';

function pendingMessage(outcome: RoundWeatherOutcome): string | null {
  switch (outcome) {
    case 'no_coordinates':
      return 'Clima no disponible: este campo no tiene coordenadas en courses.json.';
    case 'window_not_over':
      return 'El clima se descargará cuando termine el periodo de la ronda.';
    case 'unavailable':
      return 'Clima pendiente: se descargará cuando haya conexión.';
    default:
      return null;
  }
}

interface WeatherCardProps {
  weather: RoundWeather | null;
  outcome: RoundWeatherOutcome;
}

export function WeatherCard({ weather, outcome }: WeatherCardProps) {
  if (!weather) {
    const message = pendingMessage(outcome);
    return message ? <p className="muted">{message}</p> : null;
  }

  const start = new Date(weather.windowStart).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <section className="card" aria-label="Clima">
      <strong>Clima estimado</strong>
      <span>{formatWeatherLine(weather)}</span>
      <span className="muted">
        Media de {weather.hours} h desde las {start}. El viento es un valor de cuadrícula (~9 km) a
        10 m, no el de tu posición.
      </span>
      <span className="muted">
        Datos meteorológicos:{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo.com
        </a>{' '}
        (CC BY 4.0)
      </span>
    </section>
  );
}