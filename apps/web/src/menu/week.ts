import { isoWeekOf, type MenuItem, TZDate } from '@piccolo/core';
import {
  ApiError,
  loadMenu,
  loadMenuWeek,
  type MenuResponse,
  type PublicMenu,
  type WebApi,
} from '../lib/api';
import type { IsoDate } from '../order/cart';
import { localDate } from '../order/days';
import { unitPrice } from '../order/pricing';

type NoWindow = Exclude<MenuResponse, { state: 'open' }>['state'];

/**
 * What `/` shows. `week` is the order window's week when it is open (`notice` null). When the API
 * has no orderable week, it is the guest's current week to read, with `notice` saying why it
 * cannot be ordered; `none` when that week is not published either.
 */
export type MenuPage =
  | {
      kind: 'week';
      menu: PublicMenu;
      orderableDates: readonly IsoDate[];
      closedDates: readonly IsoDate[];
      notice: NoWindow | null;
    }
  | { kind: 'none'; state: NoWindow };

export async function loadMenuPage(api: WebApi, now: Date, init?: RequestInit): Promise<MenuPage> {
  const window = await loadMenu(api, init);
  if (window.state === 'open') {
    const { menu, orderableDates, closedDates } = window;
    return { kind: 'week', menu, orderableDates, closedDates, notice: null };
  }
  try {
    const current = await loadMenuWeek(api, isoWeekParam(now), init);
    if (current.state === 'open') {
      return {
        kind: 'week',
        menu: current.menu,
        orderableDates: [],
        closedDates: [],
        notice: window.state,
      };
    }
  } catch (error) {
    if (!(error instanceof ApiError && error.code === 'week_not_published')) throw error;
  }
  return { kind: 'none', state: window.state };
}

/** The ISO week of the guest's today, as `?week=` takes it: `2026-W42`. */
export function isoWeekParam(now: Date): string {
  const today = new TZDate(now.getFullYear(), now.getMonth(), now.getDate(), 'UTC');
  const { isoYear, isoWeek } = isoWeekOf(today);
  return `${isoYear}-W${String(isoWeek).padStart(2, '0')}`;
}

/** The tab to open: today when it is in the week, else the first orderable day, else Monday. */
export function initialDate(
  menu: PublicMenu,
  orderableDates: readonly IsoDate[],
  now: Date,
): IsoDate {
  const dates = Object.values(menu.days).map((day) => day.date);
  const today = localDate(now);
  if (dates.includes(today)) return today;
  return orderableDates[0] ?? menu.days[1].date;
}

/**
 * The price a dish is listed at. A daily soup has none of its own: the menu's price includes it,
 * and alone it costs `alone`. A plain side is free. Everything else is core's unit price, with a
 * Saturday price when Saturday's differs.
 */
export type ListedPrice =
  | { kind: 'soup'; alone: number }
  | { kind: 'free' }
  | { kind: 'price'; amount: number; saturday: number | null };

/** A daily soup or main, delivered on `date`. */
export function dayPrice(item: MenuItem, date: IsoDate, soupPrice: number): ListedPrice {
  if (item.category === 'daily_soup') return { kind: 'soup', alone: soupPrice };
  return { kind: 'price', amount: unitPrice(item, date), saturday: null };
}

/** A featured or permanent item, orderable on every day of `menu`'s week. */
export function weekPrice(item: MenuItem, menu: PublicMenu): ListedPrice {
  if (item.category === 'side') return { kind: 'free' };
  const amount = unitPrice(item, menu.days[1].date);
  const saturday = unitPrice(item, menu.days[6].date);
  return { kind: 'price', amount, saturday: saturday === amount ? null : saturday };
}
