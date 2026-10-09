import { strings } from './strings';

const number = new Intl.NumberFormat('hu-HU');

/**
 * `4680 Ft`, `10 400 Ft`. Hungarian groups thousands only from five digits, with a no-break space
 * (U+00A0, or the narrow U+202F in some ICU versions); both are `Intl`'s, do not "fix" them.
 */
export function forint(amount: number): string {
  return strings.common.forint(number.format(amount));
}

const dayFormat = new Intl.DateTimeFormat('hu-HU', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
  timeZone: 'UTC',
});

/** `YYYY-MM-DD` → `október 5., hétfő`. Only the calendar date is read, never a clock. */
export function longDay(isoDate: string): string {
  return dayFormat.format(new Date(`${isoDate}T00:00:00Z`));
}

/** `07:30` → `7:30`, as the masthead writes a time of day. */
export function timeOfDay(hhmm: string): string {
  return hhmm.replace(/^0(\d)/, '$1');
}

/** `+36 30 490 1122` → `tel:+36304901122`. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
