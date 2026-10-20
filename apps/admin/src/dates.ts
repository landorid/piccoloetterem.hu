import { format, isValid, parse } from 'date-fns';
import { hu } from 'react-day-picker/locale';

/** `YYYY-MM-DD` of a local calendar day. Not `toISOString()`, which shifts it to UTC. */
export function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Local midnight of an ISO date `YYYY-MM-DD`; undefined when it is not one. */
export function fromIsoDate(iso: string): Date | undefined {
  const date = parse(iso, 'yyyy-MM-dd', new Date());
  return isValid(date) ? date : undefined;
}

/** Hungarian long date with the weekday (date-fns `PPPP`), e.g. `2026. <month> 8., <weekday>`. */
export function formatDateLong(date: Date): string {
  return format(date, 'PPPP', { locale: hu });
}
