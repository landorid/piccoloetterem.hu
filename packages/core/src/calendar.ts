import { TZDate } from '@date-fns/tz';
import { addDays, getISOWeek, getISOWeeksInYear, getISOWeekYear, startOfISOWeek } from 'date-fns';
import { type MonthIndex, monthNamesHu, weekdayNamesHu } from './config/labels.hu';
import type { RestaurantConfig, Weekday } from './config/types';

/*
 * Calendar utilities. Nothing here reads the host clock or the host timezone.
 *
 * Two kinds of input:
 * - A function that is given the timezone (a `tz` argument or `config`) accepts any `Date` and
 *   treats it as an instant.
 * - A function that is not given a timezone requires a `TZDate` and reads its wall-clock fields in
 *   the zone the date carries. Get one from `toZoned`, `parseIsoDate` or `datesOfIsoWeek`. A plain
 *   `Date` would be read in the host's zone (UTC on Workers, anything in a browser), so the type
 *   rejects it.
 */

/** Monday … Sunday of one ISO week, each at local midnight. */
export type WeekDates = readonly [TZDate, TZDate, TZDate, TZDate, TZDate, TZDate, TZDate];

/** The instant `date` as a wall-clock date in `tz`. */
export function toZoned(date: Date, tz: string): TZDate {
  const zoned = new TZDate(date.getTime(), tz);
  if (Number.isNaN(zoned.getTime())) {
    throw new RangeError(`Invalid date or timezone "${tz}"`);
  }
  return zoned;
}

/** Local midnight of the ISO date `YYYY-MM-DD` in `tz`. */
export function parseIsoDate(iso: string, tz: string): TZDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]) - 1;
  const day = Number(match?.[3]);
  const date = toZoned(new TZDate(year, month, day, tz), tz);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    throw new RangeError(`Not a valid ISO date (YYYY-MM-DD): "${iso}"`);
  }
  return date;
}

/** The wall-clock calendar date of `date` as `YYYY-MM-DD`. */
export function isoDate(date: TZDate): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function isoWeekOf(date: TZDate): { isoYear: number; isoWeek: number } {
  return { isoYear: getISOWeekYear(date), isoWeek: getISOWeek(date) };
}

/** Monday … Sunday of the ISO week, as local midnights in `tz`. */
export function datesOfIsoWeek(isoYear: number, isoWeek: number, tz: string): WeekDates {
  // January 4 always falls in ISO week 1.
  const jan4 = toZoned(new TZDate(isoYear, 0, 4, tz), tz);
  if (
    !Number.isInteger(isoYear) ||
    !Number.isInteger(isoWeek) ||
    isoWeek < 1 ||
    isoWeek > getISOWeeksInYear(jan4)
  ) {
    throw new RangeError(`No ISO week ${isoWeek} in ${isoYear}`);
  }
  const monday = addDays<TZDate>(startOfISOWeek<TZDate>(jan4), (isoWeek - 1) * 7);
  const day = (offset: number) => addDays<TZDate>(monday, offset);
  return [day(0), day(1), day(2), day(3), day(4), day(5), day(6)];
}

/** ISO weekday of the wall-clock date: 1 = Monday … 7 = Sunday. */
export function weekday(date: TZDate): Weekday {
  const day = date.getDay();
  return (day === 0 ? 7 : day) as Weekday;
}

/** Whether the restaurant works on this weekday. Closed dates are a separate check: `isClosedDate`. */
export function isOperatingDay(
  date: Date,
  config: Pick<RestaurantConfig, 'timezone' | 'operatingDays'>,
): boolean {
  return config.operatingDays.includes(weekday(toZoned(date, config.timezone)));
}

/**
 * Whether ordering is switched off for the calendar day of `date` in `tz`. `closedDates` are ISO
 * dates (`YYYY-MM-DD`) set by staff; the caller loads them.
 */
export function isClosedDate(date: Date, tz: string, closedDates: readonly string[]): boolean {
  return closedDates.includes(isoDate(toZoned(date, tz)));
}

/** Whether the weekend price applies: the date is a Saturday or a Sunday. */
export function isWeekendPrice(date: TZDate): boolean {
  return weekday(date) >= 6;
}

/** e.g. `2026. szeptember 7., hétfő` */
export function formatDateHu(date: TZDate): string {
  const month = monthNamesHu[date.getMonth() as MonthIndex];
  return `${date.getFullYear()}. ${month} ${date.getDate()}., ${weekdayNamesHu[weekday(date)]}`;
}

/**
 * e.g. `2026/37. hét (09.07 – 09.12)`. The range runs from the first to the last operating day of
 * the week.
 */
export function weekLabel(
  isoYear: number,
  isoWeek: number,
  config: Pick<RestaurantConfig, 'operatingDays'>,
): string {
  // Only calendar fields are read, so any fixed zone gives the same dates.
  const week = datesOfIsoWeek(isoYear, isoWeek, 'UTC');
  const first = week[Math.min(...config.operatingDays) - 1];
  const last = week[Math.max(...config.operatingDays) - 1];
  if (!first || !last) {
    throw new RangeError('operatingDays must list at least one weekday');
  }
  return `${isoYear}/${isoWeek}. hét (${monthDay(first)} – ${monthDay(last)})`;
}

function monthDay(date: TZDate): string {
  return `${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
