import { parseIsoDate } from '../calendar';
import type { RestaurantConfig } from '../config/types';
import { priceFor } from '../menu/price';
import type { PublicMenu } from '../menu/types';
import { findItem } from './lookup';
import type {
  ComposedMenuDraft,
  DayDraft,
  PriceAdjustment,
  PricedDay,
  PricedExtra,
  PricedMenu,
  PricedMenuItem,
  PricedSubmission,
  SubmissionDraft,
} from './types';

/** The part of `RestaurantConfig` that prices an order. */
export type PricingConfig = Pick<RestaurantConfig, 'timezone' | 'pricing' | 'extras'>;

const slots = [
  ['soup', 'soupId'],
  ['main', 'mainId'],
  ['side', 'sideId'],
  ['pickle', 'pickleId'],
  ['dessert', 'dessertId'],
] as const;

export function priceMenu(
  menu: ComposedMenuDraft,
  publicMenu: PublicMenu,
  deliveryDate: string,
  config: Pick<RestaurantConfig, 'timezone' | 'pricing'>,
): PricedMenu {
  const delivery = parseIsoDate(deliveryDate, config.timezone);
  const items: PricedMenuItem[] = [];
  let soup = false;
  let mainIncludesSoup = false;

  for (const [slot, key] of slots) {
    const id = menu[key];
    if (!id) {
      continue;
    }
    const item = findItem(publicMenu, deliveryDate, slot, id);
    if (!item) {
      continue;
    }
    if (slot === 'soup') {
      soup = true;
    }
    if (slot === 'main') {
      mainIncludesSoup = item.soupIncluded;
    }
    const line: PricedMenuItem = {
      slot,
      itemId: item.id,
      name: item.name,
      unitPrice: priceFor(item, delivery),
    };
    if (slot === 'main' && menu.variation && item.variations.includes(menu.variation)) {
      line.variation = menu.variation;
    }
    items.push(line);
  }

  const adjustments: PriceAdjustment[] = [];
  if (mainIncludesSoup && !soup) {
    adjustments.push({ code: 'no_soup_discount', amount: -config.pricing.noSoupDiscount });
  }
  if (soup && !mainIncludesSoup) {
    adjustments.push({ code: 'soup_charge', amount: config.pricing.soupPrice });
  }

  const price =
    items.reduce((sum, item) => sum + item.unitPrice, 0) +
    adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
  return { items, adjustments, price };
}

export function priceDay(day: DayDraft, publicMenu: PublicMenu, config: PricingConfig): PricedDay {
  const menus = day.menus.map((menu) => priceMenu(menu, publicMenu, day.deliveryDate, config));
  const extras: PricedExtra[] = [];
  for (const extra of day.extras) {
    const def = config.extras.find((entry) => entry.key === extra.key);
    if (!def) {
      continue;
    }
    extras.push({
      key: extra.key,
      name: def.name,
      quantity: extra.quantity,
      unitPrice: def.price,
      total: def.price * extra.quantity,
    });
  }
  const foodSubtotal =
    menus.reduce((sum, menu) => sum + menu.price, 0) +
    extras.reduce((sum, extra) => sum + extra.total, 0);
  const deliveryFee = day.fulfilment === 'delivery' ? config.pricing.deliveryFee : 0;
  const missingToMinimum =
    day.fulfilment === 'delivery' ? Math.max(0, config.pricing.minimumOrder - foodSubtotal) : 0;
  return {
    menus,
    extras,
    foodSubtotal,
    deliveryFee,
    total: foodSubtotal + deliveryFee,
    missingToMinimum,
  };
}

export function priceSubmission(
  draft: Pick<SubmissionDraft, 'days'>,
  publicMenu: PublicMenu,
  config: PricingConfig,
): PricedSubmission {
  const days = draft.days.map((day) => priceDay(day, publicMenu, config));
  const foodSubtotal = days.reduce((sum, day) => sum + day.foodSubtotal, 0);
  const deliveryFee = days.reduce((sum, day) => sum + day.deliveryFee, 0);
  return { days, foodSubtotal, deliveryFee, total: foodSubtotal + deliveryFee };
}
