import type { PublicMenu } from '@piccolo/core';
import type { IsoDate } from './cart';

/**
 * `open`: in `orderableDates`. `past`: before the first orderable day, its intake is over.
 * `closed`: after the first orderable day but not orderable, so staff closed it (#60).
 */
export type DayState = 'open' | 'past' | 'closed';

export interface WeekDay {
  date: IsoDate;
  /** 0 = Monday … 5 = Saturday, an index into `strings.days.short`. */
  index: number;
  state: DayState;
}

/** The menu's days in date order, each with what the guest can do with it now. */
export function weekDays(menu: PublicMenu, orderableDates: readonly IsoDate[]): WeekDay[] {
  const orderable = new Set(orderableDates);
  const first = orderableDates[0];
  return Object.entries(menu.days)
    .map(([day, { date }]) => ({
      date,
      index: Number(day) - 1,
      state: orderable.has(date)
        ? ('open' as const)
        : first === undefined || date < first
          ? ('past' as const)
          : ('closed' as const),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** `YYYY-MM-DD` of `now` in the browser's own zone: "today" is the guest's today. */
function localDate(now: Date): IsoDate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Which cutoff sentence the week bar shows: `today` when today can still be ordered, `tomorrow`
 * when today's intake closed at `cutoff` (`HH:mm`) and tomorrow is next, nothing otherwise. Before
 * the cutoff a tomorrow-first week means staff closed today, and Sunday has no intake to close.
 */
export function cutoffNote(
  orderableDates: readonly IsoDate[],
  now: Date,
  cutoff: string,
): 'today' | 'tomorrow' | null {
  const first = orderableDates[0];
  if (first === localDate(now)) return 'today';
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const [hours = 0, minutes = 0] = cutoff.split(':').map(Number);
  const pastCutoff = now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes;
  if (first === localDate(tomorrow) && pastCutoff && now.getDay() !== 0) return 'tomorrow';
  return null;
}
