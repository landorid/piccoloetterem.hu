import { unwrap } from '@piccolo/api-client';
import type { WeekDraft } from '@piccolo/core';
import { queryOptions } from '@tanstack/react-query';
import { api } from '@/api';
import type { IsoWeek } from './model';

/*
 * The weekly menu's reads and writes, through the typed client. The keys sit under
 * `['admin', 'menu']`, so one invalidation reaches all of them.
 */

const menu = api.api.admin.menu;

const weekParam = ({ isoYear, isoWeek }: IsoWeek) => ({
  year: String(isoYear),
  week: String(isoWeek),
});

/** The week the editor opens on when the URL names none. */
export const defaultWeekQuery = queryOptions({
  queryKey: ['admin', 'menu', 'default-week'],
  queryFn: async () => unwrap(await menu['default-week'].$get()),
});

async function fetchWeek(week: IsoWeek) {
  return unwrap(await menu.weeks[':year'][':week'].$get({ param: weekParam(week) }));
}

/** A stored week, as `GET /weeks/:year/:week` returns it. Its lists fit `WeekDraft`. */
export type StoredWeek = Awaited<ReturnType<typeof fetchWeek>>;

export const weekKey = (week: IsoWeek) =>
  ['admin', 'menu', 'week', week.isoYear, week.isoWeek] as const;

export const weekQuery = (week: IsoWeek) =>
  queryOptions({ queryKey: weekKey(week), queryFn: () => fetchWeek(week) });

export async function saveWeek(week: IsoWeek, draft: WeekDraft): Promise<StoredWeek> {
  return unwrap(await menu.weeks[':year'][':week'].$put({ param: weekParam(week), json: draft }));
}

export async function publishWeek(week: IsoWeek) {
  return unwrap(await menu.weeks[':year'][':week'].publish.$post({ param: weekParam(week) }));
}

export async function setSoldOut(id: string, soldOut: boolean) {
  return unwrap(await menu.items[':id']['sold-out'].$post({ param: { id }, json: { soldOut } }));
}

export const closedDatesKey = (from: string, to: string) =>
  ['admin', 'menu', 'closed-dates', from, to] as const;

/** The closed dates from `from` to `to`, both `YYYY-MM-DD` and included. */
export const closedDatesQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: closedDatesKey(from, to),
    queryFn: async () => unwrap(await menu['closed-dates'].$get({ query: { from, to } })),
  });

/** Closes `date` for ordering, or opens it again. */
export async function setClosed(date: string, closed: boolean) {
  if (closed) {
    return unwrap(await menu['closed-dates'].$post({ json: { date } }));
  }
  return unwrap(await menu['closed-dates'][':date'].$delete({ param: { date } }));
}
