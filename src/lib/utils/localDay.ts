/**
 * Utilidades para trabajar con el "día" del usuario en SU zona horaria.
 *
 * Por qué existe: antes, el "día" de las flashcards se calculaba con la
 * medianoche UTC. En México eso cae a media tarde (5-6 pm), así que a esa
 * hora la app creía que había empezado un día nuevo y reiniciaba el tope
 * de tarjetas nuevas. Aquí el día cambia a la medianoche de la zona
 * horaria de estudio.
 *
 * Para cambiar de zona horaria basta con editar STUDY_TIMEZONE (nombre IANA).
 * Sinaloa = 'America/Mazatlan' (UTC-7, sin horario de verano).
 */
export const STUDY_TIMEZONE = 'America/Mazatlan';

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

/** Fecha local "AAAA-MM-DD" en la zona horaria indicada. */
export function getLocalDateString(
  date: Date = new Date(),
  timeZone: string = STUDY_TIMEZONE
): string {
  const p = getZonedParts(date, timeZone);
  const mm = String(p.month).padStart(2, '0');
  const dd = String(p.day).padStart(2, '0');
  return `${p.year}-${mm}-${dd}`;
}

/**
 * Instante UTC (ISO) en que empezó el día local de `date` (su medianoche
 * local). Sirve para preguntar a la base de datos "¿qué pasó hoy?".
 */
export function startOfLocalDayUtcISO(
  date: Date = new Date(),
  timeZone: string = STUDY_TIMEZONE
): string {
  const p = getZonedParts(date, timeZone);
  const wallClockAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const instantMs = Math.floor(date.getTime() / 1000) * 1000;
  const offsetMs = wallClockAsUtc - instantMs;
  const localMidnightAsUtc = Date.UTC(p.year, p.month - 1, p.day);
  return new Date(localMidnightAsUtc - offsetMs).toISOString();
}
