import type { PriceAdjustment } from './types';

/**
 * The adjustments of a stored menu. They are not stored: `order_menus.price` is the menu's price
 * with them, and each `order_items.unit_price` the item's own, so the difference is the
 * adjustment. Only one of the two can apply to a menu (`priceMenu`), so its sign says which.
 */
export function adjustmentsOf(menuPrice: number, unitPrices: readonly number[]): PriceAdjustment[] {
  const amount = menuPrice - unitPrices.reduce((sum, price) => sum + price, 0);
  if (amount < 0) {
    return [{ code: 'no_soup_discount', amount }];
  }
  if (amount > 0) {
    return [{ code: 'soup_charge', amount }];
  }
  return [];
}
