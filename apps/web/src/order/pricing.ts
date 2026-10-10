import {
  type DayDraft,
  type ExtraDef,
  type MenuItem,
  type PriceAdjustment,
  type PricedDay,
  type PricedMenu,
  type PricedMenuItem,
  type PricingConfig,
  type PublicMenu,
  parseIsoDate,
  priceDay,
  priceFor,
  priceMenu,
  priceSubmission,
} from '@piccolo/core';
import type { CartState, IsoDate } from './cart';
import { type ExtraQuantities, type MenuForm, toComposedMenu } from './form';

/*
 * Every forint on the page comes from core. These helpers only choose what to ask core; nothing
 * here adds, subtracts or multiplies money.
 */

/**
 * Pricing reads only the weekday of a delivery date (weekend prices on Saturday), and a calendar
 * date has the same weekday in every zone. The public config carries no timezone, so the browser
 * prices in UTC.
 */
const calendarZone = 'UTC';

export function pricingConfig(config: Pick<PricingConfig, 'pricing' | 'extras'>): PricingConfig {
  return { timezone: calendarZone, pricing: config.pricing, extras: config.extras };
}

/** The unit price of a dish delivered on `date`. */
export function unitPrice(item: Pick<MenuItem, 'priceWeekday' | 'priceWeekend'>, date: IsoDate) {
  return priceFor(item, parseIsoDate(date, calendarZone));
}

/** Extra quantities as core's drafts, in the config's order. */
function extraDrafts(extras: ExtraQuantities, defs: readonly ExtraDef[]) {
  return defs.flatMap((def) => {
    const quantity = extras[def.key];
    return quantity ? [{ key: def.key, quantity }] : [];
  });
}

function dayDraft(
  date: IsoDate,
  menus: DayDraft['menus'],
  extras: ExtraQuantities,
  config: PricingConfig,
): DayDraft {
  return {
    deliveryDate: date,
    fulfilment: 'delivery',
    menus,
    extras: extraDrafts(extras, config.extras),
  };
}

export interface PricedForm {
  /** The menu the form describes, for the price box. */
  menu: PricedMenu;
  /** The menu and the pending extras: the footer's live price. */
  total: number;
  /** The pending extras alone: the price box's "extras" line. */
  extrasSubtotal: number;
}

export function priceForm(
  form: MenuForm,
  publicMenu: PublicMenu,
  date: IsoDate,
  config: PricingConfig,
): PricedForm {
  const composed = toComposedMenu(form);
  return {
    menu: priceMenu(composed, publicMenu, date, config),
    total: priceDay(dayDraft(date, [composed], form.extras, config), publicMenu, config)
      .foodSubtotal,
    extrasSubtotal: priceDay(dayDraft(date, [], form.extras, config), publicMenu, config)
      .foodSubtotal,
  };
}

/**
 * What choosing a soup option (or declining, `null`) does to the menu's price: the adjustment core
 * would add, or 0. With no main yet there is no honest amount for a soup dish, so it is `null`.
 */
export function soupEffect(
  form: MenuForm,
  soupId: string | null,
  publicMenu: PublicMenu,
  date: IsoDate,
  config: PricingConfig,
): number | null {
  if (soupId !== null && form.mainId === null) {
    return null;
  }
  const { adjustments } = priceMenu(toComposedMenu({ ...form, soupId }), publicMenu, date, config);
  return adjustments[0]?.amount ?? 0;
}

export type PriceLine =
  | { kind: 'item'; item: PricedMenuItem }
  | { kind: 'adjustment'; adjustment: PriceAdjustment };

/** A priced menu's lines as the receipt reads: soup, main, its adjustment, then the rest. */
export function priceLines(menu: PricedMenu): PriceLine[] {
  const lead = (item: PricedMenuItem) => item.slot === 'soup' || item.slot === 'main';
  return [
    ...menu.items.filter(lead).map((item) => ({ kind: 'item' as const, item })),
    ...menu.adjustments.map((adjustment) => ({ kind: 'adjustment' as const, adjustment })),
    ...menu.items.filter((item) => !lead(item)).map((item) => ({ kind: 'item' as const, item })),
  ];
}

export interface PricedCart {
  /** The cart's days in date order. */
  days: Array<{ date: IsoDate; priced: PricedDay }>;
  menuCount: number;
  foodSubtotal: number;
  deliveryFee: number;
  total: number;
}

export function priceCart(
  state: CartState,
  publicMenu: PublicMenu,
  config: PricingConfig,
): PricedCart {
  const dates = Object.keys(state.menusByDate).sort();
  const drafts = dates.map((date) =>
    dayDraft(date, state.menusByDate[date] ?? [], state.extrasByDate[date] ?? {}, config),
  );
  const submission = priceSubmission({ days: drafts }, publicMenu, config);
  return {
    days: submission.days.flatMap((priced, i) => {
      const date = dates[i];
      return date === undefined ? [] : [{ date, priced }];
    }),
    menuCount: drafts.reduce((count, day) => count + day.menus.length, 0),
    foodSubtotal: submission.foodSubtotal,
    deliveryFee: submission.deliveryFee,
    total: submission.total,
  };
}
