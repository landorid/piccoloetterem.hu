import { strings } from './strings';

const number = new Intl.NumberFormat('hu-HU');

/**
 * `4680 Ft`, `10 400 Ft`. Hungarian groups thousands only from five digits, with a no-break space
 * (U+00A0, or the narrow U+202F in some ICU versions); both are `Intl`'s, do not "fix" them.
 */
export function forint(amount: number): string {
  return strings.common.forint(number.format(amount));
}

/** A price adjustment: `+650 Ft`, `−100 Ft`, and `0 Ft` for none. */
export function signedForint(amount: number): string {
  if (amount > 0) return strings.common.plus(forint(amount));
  if (amount < 0) return strings.common.minus(forint(-amount));
  return forint(0);
}

// Only the calendar date of an ISO date is ever read, never a clock, so every format is in UTC.
const formats = {
  weekday: new Intl.DateTimeFormat('hu-HU', { weekday: 'long', timeZone: 'UTC' }),
  short: new Intl.DateTimeFormat('hu-HU', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
  long: new Intl.DateTimeFormat('hu-HU', { month: 'long', day: 'numeric', timeZone: 'UTC' }),
  day: new Intl.DateTimeFormat('hu-HU', { day: 'numeric', timeZone: 'UTC' }),
};

const asDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

function capitalise(text: string): string {
  return text.charAt(0).toLocaleUpperCase('hu-HU') + text.slice(1);
}

/** The weekday of `YYYY-MM-DD`, capitalised as it starts a line. */
export function weekdayName(isoDate: string): string {
  return capitalise(formats.weekday.format(asDate(isoDate)));
}

/** The weekday and the short date, as a day is named in the cart and the summary. */
export function dayFull(isoDate: string): string {
  return strings.days.full(weekdayName(isoDate), formats.short.format(asDate(isoDate)));
}

const longDayFormat = new Intl.DateTimeFormat('hu-HU', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
  timeZone: 'UTC',
});

/** The month, the day and the weekday of `YYYY-MM-DD`. */
export function longDay(isoDate: string): string {
  return longDayFormat.format(asDate(isoDate));
}

/** The day of the month without its ordinal dot, as a calendar grid writes it. */
export function dayNumber(isoDate: string): string {
  return formats.day.format(asDate(isoDate));
}

/** The week's first to last day; the month is written once when both share it. */
export function weekRange(first: string, last: string): string {
  const from = formats.long.format(asDate(first));
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  const to = sameMonth
    ? formats.long
        .formatToParts(asDate(last))
        .filter((part) => part.type === 'day' || (part.type === 'literal' && part.value.trim()))
        .map((part) => part.value)
        .join('')
    : formats.long.format(asDate(last));
  return strings.week.range(from, to);
}

/** `07:30` → `7:30`, as the masthead writes a time of day. */
export function timeOfDay(hhmm: string): string {
  return hhmm.replace(/^0(\d)/, '$1');
}

/** `+36 30 490 1122` → `tel:+36304901122`. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
