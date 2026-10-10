import type { TZDate } from '@date-fns/tz';
import { addDays } from 'date-fns';
import {
  datesOfIsoWeek,
  isClosedDate,
  isOperatingDay,
  isoDate,
  isoWeekOf,
  toZoned,
  weekday,
} from '../calendar';
import type { RestaurantConfig } from '../config/types';

export type WindowConfig = Pick<
  RestaurantConfig,
  'timezone' | 'cutoff' | 'operatingDays' | 'lastSameWeekOrderDay'
>;

/** Whether staff have published the menu of this ISO week. The caller loads `menu_weeks`. */
export type IsPublished = (isoYear: number, isoWeek: number) => boolean;

export type OrderWindow =
  /** Guests may order for `dates`, all in one ISO week, in order. */
  | { kind: 'open'; isoYear: number; isoWeek: number; dates: TZDate[] }
  /** Ordering has rolled over to next week, whose menu is not published yet. */
  | { kind: 'next_week_not_published' }
  /** The current week is not published, or none of its remaining days can be ordered. */
  | { kind: 'closed_week' };

/**
 * The first day the cutoff rule allows ordering for at `now`, at local midnight:
 * - before the cutoff, up to and including `lastSameWeekOrderDay`: today;
 * - after the cutoff, before `lastSameWeekOrderDay`: tomorrow;
 * - otherwise (after the cutoff on `lastSameWeekOrderDay`, and every later day of the week): next
 *   week's Monday.
 *
 * Publication, operating days and closed dates are not applied here; `orderWindow` applies them.
 * Admin screens use this to pick the week they open on.
 */
export function firstOrderableDay(now: Date, config: WindowConfig): TZDate {
  const local = toZoned(now, config.timezone);
  const { isoYear, isoWeek } = isoWeekOf(local);
  const [monday] = datesOfIsoWeek(isoYear, isoWeek, config.timezone);
  const today = weekday(local);
  const beforeCutoff = local.getHours() * 60 + local.getMinutes() < minutesOfDay(config.cutoff);
  const last = config.lastSameWeekOrderDay;

  if (today < last || (today === last && beforeCutoff)) {
    // Monday is offset 0, so today is `today - 1` and tomorrow is `today`.
    return addDays<TZDate>(monday, beforeCutoff ? today - 1 : today);
  }
  return addDays<TZDate>(monday, 7);
}

/**
 * The delivery date the staff's order list opens on at `now`: today until the cutoff, then the
 * next operating day, whose orders are the ones coming in. Today counts only if it is an
 * operating day. Unlike `firstOrderableDay`, this ignores `lastSameWeekOrderDay`: a Saturday's
 * orders are taken by Friday's cutoff, and staff still work them on Saturday. Closed dates are
 * not skipped; the caller has no database.
 */
export function staffOrdersDay(
  now: Date,
  config: Pick<RestaurantConfig, 'timezone' | 'cutoff' | 'operatingDays'>,
): TZDate {
  const local = toZoned(now, config.timezone);
  const { isoYear, isoWeek } = isoWeekOf(local);
  const today = addDays<TZDate>(
    datesOfIsoWeek(isoYear, isoWeek, config.timezone)[0],
    weekday(local) - 1,
  );
  const beforeCutoff = local.getHours() * 60 + local.getMinutes() < minutesOfDay(config.cutoff);
  if (beforeCutoff && isOperatingDay(today, config)) {
    return today;
  }
  for (let offset = 1; offset <= 7; offset += 1) {
    const day = addDays<TZDate>(today, offset);
    if (isOperatingDay(day, config)) {
      return day;
    }
  }
  throw new RangeError('operatingDays must list at least one weekday');
}

/**
 * The days a guest may order for at `now`: from the first orderable day to the end of that ISO
 * week, keeping only operating days that are not in `closedDates` (`YYYY-MM-DD`). The week must be
 * published.
 */
export function orderWindow(
  now: Date,
  config: WindowConfig,
  isPublished: IsPublished,
  closedDates: readonly string[],
): OrderWindow {
  const first = firstOrderableDay(now, config);
  const { isoYear, isoWeek } = isoWeekOf(first);

  if (!isPublished(isoYear, isoWeek)) {
    const current = isoWeekOf(toZoned(now, config.timezone));
    const rolledOver = current.isoYear !== isoYear || current.isoWeek !== isoWeek;
    return rolledOver ? { kind: 'next_week_not_published' } : { kind: 'closed_week' };
  }

  const dates = datesOfIsoWeek(isoYear, isoWeek, config.timezone)
    .slice(weekday(first) - 1)
    .filter(
      (date) => isOperatingDay(date, config) && !isClosedDate(date, config.timezone, closedDates),
    );

  return dates.length > 0 ? { kind: 'open', isoYear, isoWeek, dates } : { kind: 'closed_week' };
}

/**
 * Whether an order for the calendar day of `deliveryDate` (read in the restaurant's timezone) may
 * be accepted at `now`. The server's check at submission.
 */
export function isOrderable(
  deliveryDate: Date,
  now: Date,
  config: WindowConfig,
  isPublished: IsPublished,
  closedDates: readonly string[],
): boolean {
  const window = orderWindow(now, config, isPublished, closedDates);
  if (window.kind !== 'open') {
    return false;
  }
  const target = isoDate(toZoned(deliveryDate, config.timezone));
  return window.dates.some((date) => isoDate(date) === target);
}

/** Minutes since midnight of an `HH:mm` time. */
function minutesOfDay(time: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) {
    throw new RangeError(`Not a valid time of day (HH:mm): "${time}"`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}
